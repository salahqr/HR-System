<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * Tests for UserController.
 *
 * SETUP (edit the constants and helpers below if yours differ):
 *  - BASE   : the URL prefix of your user routes
 *  - Login is simulated with actingAs() on the "api" guard and only the
 *    jwt middleware is skipped (see actAs())
 *  - User::factory() and Department::factory() must exist
 *    (add `use HasFactory;` to the models and create the factories)
 *
 * Tests marked "KNOWN BUG" describe the rules you decided, but the current
 * controller does not follow them yet. They are expected to fail until fixed.
 */
class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/user/users';

    /* ------------------------------------------------------------------
     | Helpers
     |------------------------------------------------------------------ */

    private function makeUser(string $role, array $attrs = []): User
    {
        return User::factory()->create(array_merge([
            'role' => $role,
            'is_supervisor' => false,
            'archived_at' => null,
        ], $attrs));
    }

    private function admin(array $a = []): User
    {
        return $this->makeUser('admin', $a);
    }

    private function hr(array $a = []): User
    {
        return $this->makeUser('hr', $a);
    }

    private function supervisor(array $a = []): User
    {
        return $this->makeUser('hr', array_merge($a, ['is_supervisor' => true]));
    }

    private function employee(array $a = []): User
    {
        return $this->makeUser('employee', $a);
    }

    private function department(array $a = []): Department
    {
        return Department::factory()->create(array_merge(['head_id' => null], $a));
    }

private function actAs(User $user): static
{
    $token = JWTAuth::fromUser($user);

    return $this->withHeaders([
        'Cookie' => 'token=' . $token,
    ]);
}
    private function actor(string $role, bool $supervisor = false): User
    {
        return $this->makeUser($role, ['is_supervisor' => $supervisor]);
    }

    private function ids($response): array
    {
        return collect($response->json('data'))->pluck('id')->all();
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'New Person',
            'email' => 'new.person@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'employee',
        ], $overrides);
    }

    /* ------------------------------------------------------------------
     | Guests
     |------------------------------------------------------------------ */

    public function test_guest_cannot_use_any_user_endpoint(): void
    {
        $user = $this->employee();

        $this->getJson(self::BASE)->assertUnauthorized();
        $this->postJson(self::BASE, $this->payload())->assertUnauthorized();
        $this->getJson(self::BASE . '/' . $user->id)->assertUnauthorized();
        $this->putJson(self::BASE . '/' . $user->id, ['name' => 'X'])->assertUnauthorized();
    }

    /* ------------------------------------------------------------------
     | GET /user/users(list)
     |------------------------------------------------------------------ */

    public function test_admin_sees_every_role_in_the_list(): void
    {
        $admin = $this->admin();
        $hr = $this->hr();
        $supervisor = $this->supervisor();
        $employee = $this->employee();

        $ids = $this->ids($this->actAs($admin)->getJson(self::BASE)->assertOk());

        $this->assertEqualsCanonicalizing(
            [$admin->id, $hr->id, $supervisor->id, $employee->id],
            $ids
        );
    }

    public function test_supervisor_sees_admin_hr_and_employees(): void
    {
        $admin = $this->admin();
        $hr = $this->hr();
        $supervisor = $this->supervisor();
        $employee = $this->employee();

        $ids = $this->ids($this->actAs($supervisor)->getJson(self::BASE)->assertOk());

        $this->assertEqualsCanonicalizing(
            [$admin->id, $hr->id, $supervisor->id, $employee->id],
            $ids
        );
    }

    public function test_normal_hr_sees_only_employees(): void
    {
        $this->admin();
        $otherHr = $this->hr();
        $this->supervisor();
        $e1 = $this->employee();
        $e2 = $this->employee();
        $normalHr = $this->hr();

        $ids = $this->ids($this->actAs($normalHr)->getJson(self::BASE)->assertOk());

        $this->assertEqualsCanonicalizing([$e1->id, $e2->id], $ids);
        $this->assertNotContains($otherHr->id, $ids);
        $this->assertNotContains($normalHr->id, $ids);
    }

    public function test_employee_sees_only_himself(): void
    {
        $me = $this->employee();
        $this->employee();
        $this->hr();
        $this->admin();

        $ids = $this->ids($this->actAs($me)->getJson(self::BASE)->assertOk());

        $this->assertSame([$me->id], $ids);
    }

    public function test_list_does_not_expose_salary_or_password(): void
    {
        $admin = $this->admin();
        $this->employee(['salary' => 5000]);

        $response = $this->actAs($admin)->getJson(self::BASE)->assertOk();

        foreach ($response->json('data') as $row) {
            $this->assertArrayNotHasKey('salary', $row);
            $this->assertArrayNotHasKey('password', $row);
        }
    }

    public function test_list_is_paginated_by_ten(): void
    {
        $admin = $this->admin();
        User::factory()->count(14)->create(['role' => 'employee', 'archived_at' => null]);

        $page1 = $this->actAs($admin)->getJson(self::BASE)->assertOk();
        $this->assertCount(10, $page1->json('data'));
        $this->assertSame(15, $page1->json('total'));
        $this->assertSame(10, $page1->json('per_page'));

        $page2 = $this->actAs($admin)->getJson(self::BASE . '?page=2')->assertOk();
        $this->assertCount(5, $page2->json('data'));
    }

    public function test_list_can_filter_by_name(): void
    {
        $admin = $this->admin();
        $target = $this->employee(['name' => 'Zed Unique']);
        $this->employee(['name' => 'Someone Else']);

        $ids = $this->ids($this->actAs($admin)->getJson(self::BASE . '?name=Unique')->assertOk());

        $this->assertSame([$target->id], $ids);
    }

    public function test_list_can_filter_by_job_title(): void
    {
        $admin = $this->admin();
        $target = $this->employee(['job_title' => 'Quantum Plumber']);
        $this->employee(['job_title' => 'Accountant']);

        $ids = $this->ids($this->actAs($admin)->getJson(self::BASE . '?job_title=Quantum')->assertOk());

        $this->assertSame([$target->id], $ids);
    }

    public function test_list_can_filter_by_department_and_returns_department_name(): void
    {
        $admin = $this->admin();
        $dept = $this->department(['name' => 'Engineering']);
        $other = $this->department(['name' => 'Sales']);
        $in = $this->employee(['department_id' => $dept->id]);
        $this->employee(['department_id' => $other->id]);

        $response = $this->actAs($admin)
            ->getJson(self::BASE . '?department_id=' . $dept->id)
            ->assertOk();

        $this->assertSame([$in->id], $this->ids($response));
        $this->assertSame('Engineering', $response->json('data.0.department_name'));
    }

    public function test_list_can_filter_by_active_and_archived_status(): void
    {
        $admin = $this->admin();
        $active = $this->employee();
        $archived = $this->employee(['archived_at' => now()]);

        $activeIds = $this->ids($this->actAs($admin)->getJson(self::BASE . '?status=active')->assertOk());
        $archivedIds = $this->ids($this->actAs($admin)->getJson(self::BASE . '?status=archived')->assertOk());

        $this->assertContains($active->id, $activeIds);
        $this->assertNotContains($archived->id, $activeIds);
        $this->assertSame([$archived->id], $archivedIds);
    }

    public function test_list_rejects_bad_filters(): void
    {
        $admin = $this->admin();

        $this->actAs($admin)->getJson(self::BASE . '?status=deleted')->assertUnprocessable();
        $this->actAs($admin)->getJson(self::BASE . '?department_id=not-a-uuid')->assertUnprocessable();
        $this->actAs($admin)->getJson(self::BASE . '?page=0')->assertUnprocessable();
    }

    /* ------------------------------------------------------------------
     | POST /user/users(create)
     |------------------------------------------------------------------ */

    public static function adminCreatableRoles(): array
    {
        return [['admin'], ['hr'], ['employee']];
    }

    #[DataProvider('adminCreatableRoles')]
    public function test_admin_can_create_any_role(string $role): void
    {
        $admin = $this->admin();

        $this->actAs($admin)
            ->postJson(self::BASE, $this->payload(['role' => $role]))
            ->assertCreated()
            ->assertJsonPath('user.role', $role);

        $this->assertDatabaseHas('users', ['email' => 'new.person@example.com', 'role' => $role]);
    }

    public static function supervisorCreatableRoles(): array
    {
        return [['hr'], ['employee']];
    }

    #[DataProvider('supervisorCreatableRoles')]
    public function test_supervisor_can_create_hr_and_employee(string $role): void
    {
        $this->actAs($this->supervisor())
            ->postJson(self::BASE, $this->payload(['role' => $role]))
            ->assertCreated()
            ->assertJsonPath('user.role', $role);
    }

    public function test_supervisor_cannot_create_an_admin(): void
    {
        $this->actAs($this->supervisor())
            ->postJson(self::BASE, $this->payload(['role' => 'admin']))
            ->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.com']);
    }

    public function test_normal_hr_and_employee_cannot_create_users(): void
    {
        $this->actAs($this->hr())
            ->postJson(self::BASE, $this->payload())
            ->assertForbidden();

        $this->actAs($this->employee())
            ->postJson(self::BASE, $this->payload())
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.com']);
    }

    public function test_created_password_is_hashed(): void
    {
        $this->actAs($this->admin())
            ->postJson(self::BASE, $this->payload())
            ->assertCreated()
            ->assertJsonMissingPath('user.password');

        $stored = User::where('email', 'new.person@example.com')->first();

        $this->assertNotSame('password123', $stored->password);
        $this->assertTrue(Hash::check('password123', $stored->password));
    }

    public function test_create_validates_input(): void
    {
        $admin = $this->admin();

        // required fields
        $this->actAs($admin)->postJson(self::BASE, [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password', 'role']);

        // password confirmation + length
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['password_confirmation' => 'different']))
            ->assertUnprocessable()->assertJsonValidationErrors(['password']);
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['password' => 'short', 'password_confirmation' => 'short']))
            ->assertUnprocessable()->assertJsonValidationErrors(['password']);

        // email
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['email' => 'nope']))
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);

        // role
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['role' => 'boss']))
            ->assertUnprocessable()->assertJsonValidationErrors(['role']);

        // other fields
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['salary' => -1]))
            ->assertUnprocessable()->assertJsonValidationErrors(['salary']);
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['hire_date' => now()->addDay()->toDateString()]))
            ->assertUnprocessable()->assertJsonValidationErrors(['hire_date']);
        $this->actAs($admin)->postJson(self::BASE, $this->payload(['department_id' => '11111111-1111-1111-1111-111111111111']))
            ->assertUnprocessable()->assertJsonValidationErrors(['department_id']);
    }

    public function test_create_rejects_duplicate_email(): void
    {
        $admin = $this->admin();
        $this->employee(['email' => 'new.person@example.com']);

        $this->actAs($admin)->postJson(self::BASE, $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_admin_can_create_a_supervisor_hr(): void
    {
        $this->actAs($this->admin())
            ->postJson(self::BASE, $this->payload(['role' => 'hr', 'is_supervisor' => true]))
            ->assertCreated();

        $this->assertTrue((bool) User::where('email', 'new.person@example.com')->first()->is_supervisor);
    }

    public function test_supervisor_cannot_create_another_supervisor(): void
    {
        $this->actAs($this->supervisor())
            ->postJson(self::BASE, $this->payload(['role' => 'hr', 'is_supervisor' => true]))
            ->assertCreated();

        $this->assertFalse((bool) User::where('email', 'new.person@example.com')->first()->is_supervisor);
    }

    public function test_only_hr_can_be_supervisor_on_create(): void
    {
        $this->actAs($this->admin())
            ->postJson(self::BASE, $this->payload(['role' => 'employee', 'is_supervisor' => true]))
            ->assertUnprocessable();
    }

    public function test_create_can_assign_department_head(): void
    {
        $dept = $this->department();

        $response = $this->actAs($this->admin())
            ->postJson(self::BASE, $this->payload([
                'role' => 'hr',
                'department_id' => $dept->id,
                'is_head_of_department' => true,
            ]))
            ->assertCreated();

        $this->assertSame($response->json('user.id'), $dept->fresh()->head_id);
    }

    public function test_department_head_on_create_needs_a_department(): void
    {
        $this->actAs($this->admin())
            ->postJson(self::BASE, $this->payload(['role' => 'hr', 'is_head_of_department' => true]))
            ->assertUnprocessable();
    }

    public function test_department_head_on_create_must_be_hr(): void
    {
        $dept = $this->department();

        $this->actAs($this->admin())
            ->postJson(self::BASE, $this->payload([
                'role' => 'employee',
                'department_id' => $dept->id,
                'is_head_of_department' => true,
            ]))
            ->assertUnprocessable();

        $this->assertNull($dept->fresh()->head_id);
    }

    /* ------------------------------------------------------------------
     | GET /user/users/{id}  (show)
     |------------------------------------------------------------------ */

    public function test_admin_can_view_anyone(): void
    {
        $admin = $this->admin();

        foreach ([$this->admin(), $this->hr(), $this->employee()] as $target) {
            $this->actAs($admin)
                ->getJson(self::BASE . '/' . $target->id)
                ->assertOk()
                ->assertJsonPath('user.id', $target->id);
        }
    }

    public function test_supervisor_can_view_admin_hr_and_employee(): void
    {
        $supervisor = $this->supervisor();

        foreach ([$this->admin(), $this->hr(), $this->employee()] as $target) {
            $this->actAs($supervisor)
                ->getJson(self::BASE . '/' . $target->id)
                ->assertOk();
        }
    }

    public function test_normal_hr_can_view_employee_but_not_hr_or_admin(): void
    {
        $normalHr = $this->hr();

        $this->actAs($normalHr)->getJson(self::BASE . '/' . $this->employee()->id)->assertOk();
        $this->actAs($normalHr)->getJson(self::BASE . '/' . $this->hr()->id)->assertNotFound();
        $this->actAs($normalHr)->getJson(self::BASE . '/' . $this->admin()->id)->assertNotFound();
    }

    public function test_employee_can_view_only_himself(): void
    {
        $me = $this->employee();

        $this->actAs($me)->getJson(self::BASE . '/' . $me->id)->assertOk();
        $this->actAs($me)->getJson(self::BASE . '/' . $this->employee()->id)->assertNotFound();
        $this->actAs($me)->getJson(self::BASE . '/' . $this->admin()->id)->assertNotFound();
    }

    public function test_show_returns_404_for_unknown_id_and_hides_password(): void
    {
        $admin = $this->admin();

        $this->actAs($admin)
            ->getJson(self::BASE . '/11111111-1111-1111-1111-111111111111')
            ->assertNotFound();

        $this->actAs($admin)
            ->getJson(self::BASE . '/' . $this->employee()->id)
            ->assertOk()
            ->assertJsonMissingPath('user.password');
    }

    /* ------------------------------------------------------------------
     | PUT /user/users/{user}  (update) : Admin
     |------------------------------------------------------------------ */

    public function test_admin_has_full_edit_on_employee(): void
    {
        $dept = $this->department();
        $target = $this->employee();

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $target->id, [
                'name' => 'Renamed',
                'email' => 'renamed@example.com',
                'department_id' => $dept->id,
                'job_title' => 'Lead',
                'hire_date' => '2024-01-15',
                'salary' => 7500,
                'phone' => '0790000000',
                'address' => 'Zarqa',
            ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Renamed');

        $fresh = $target->fresh();
        $this->assertSame('renamed@example.com', $fresh->email);
        $this->assertSame($dept->id, $fresh->department_id);
        $this->assertSame('Lead', $fresh->job_title);
        $this->assertEquals(7500, $fresh->salary);
        $this->assertSame('0790000000', $fresh->phone);
        $this->assertSame('Zarqa', $fresh->address);
    }

    public function test_admin_can_change_role_and_supervisor_flag_of_hr(): void
    {
        $admin = $this->admin();
        $target = $this->hr();

        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $target->id, ['is_supervisor' => true])
            ->assertOk();
        $this->assertTrue((bool) $target->fresh()->is_supervisor);

        $employee = $this->employee();
        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $employee->id, ['role' => 'hr'])
            ->assertOk();
        $this->assertSame('hr', $employee->fresh()->role);
    }

    public function test_admin_can_archive_and_restore_a_user(): void
    {
        $admin = $this->admin();
        $target = $this->employee();

        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $target->id, ['is_active' => false])
            ->assertOk();
        $this->assertNotNull($target->fresh()->archived_at);

        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $target->id, ['is_active' => true])
            ->assertOk();
        $this->assertNull($target->fresh()->archived_at);
    }

    public function test_archiving_twice_keeps_the_first_archive_date(): void
    {
        $admin = $this->admin();
        $first = now()->subDays(5)->startOfSecond();
        $target = $this->employee(['archived_at' => $first]);

        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $target->id, ['is_active' => false])
            ->assertOk();

        $this->assertEquals($first->timestamp, $target->fresh()->archived_at->timestamp);
    }

    public function test_admin_cannot_edit_another_admin(): void
    {
        $admin = $this->admin();
        $other = $this->admin(['name' => 'Other Admin']);

        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $other->id, ['name' => 'Hacked'])
            ->assertForbidden();

        $this->assertSame('Other Admin', $other->fresh()->name);
    }

    public function test_admin_editing_himself_only_changes_personal_fields(): void
    {
        $admin = $this->admin(['salary' => 1000, 'job_title' => 'Boss']);

        $this->actAs($admin)
            ->putJson(self::BASE . '/' . $admin->id, [
                'phone' => '0791111111',
                'address' => 'New address',
                'salary' => 99999,
                'role' => 'employee',
                'job_title' => 'King',
            ])
            ->assertOk();

        $fresh = $admin->fresh();
        $this->assertSame('0791111111', $fresh->phone);
        $this->assertSame('New address', $fresh->address);
        $this->assertEquals(1000, $fresh->salary);
        $this->assertSame('admin', $fresh->role);
        $this->assertSame('Boss', $fresh->job_title);
    }

    /* ------------------------------------------------------------------
     | PUT /user/users/{user} : Supervisor HR
     |------------------------------------------------------------------ */

    public function test_supervisor_has_full_edit_on_employee_hr_and_admin(): void
    {
        $supervisor = $this->supervisor();

        foreach ([$this->employee(), $this->hr(), $this->admin()] as $target) {
            $this->actAs($supervisor)
                ->putJson(self::BASE . '/' . $target->id, ['salary' => 4200, 'job_title' => 'Updated'])
                ->assertOk();

            $fresh = $target->fresh();
            $this->assertEquals(4200, $fresh->salary);
            $this->assertSame('Updated', $fresh->job_title);
        }
    }

    public function test_supervisor_cannot_change_role_or_supervisor_flag(): void
    {
        $supervisor = $this->supervisor();
        $employee = $this->employee();
        $hr = $this->hr();

        $this->actAs($supervisor)
            ->putJson(self::BASE . '/' . $employee->id, ['name' => 'Ok', 'role' => 'admin'])
            ->assertOk();
        $this->assertSame('employee', $employee->fresh()->role);

        $this->actAs($supervisor)
            ->putJson(self::BASE . '/' . $hr->id, ['name' => 'Ok', 'is_supervisor' => true])
            ->assertOk();
        $this->assertFalse((bool) $hr->fresh()->is_supervisor);
    }

    /**
     * KNOWN BUG: a supervisor editing himself currently gets the full HR field
     * list. Your rule says: own account = personal fields only.
     */
    public function test_supervisor_editing_himself_only_changes_personal_fields(): void
    {
        $supervisor = $this->supervisor(['salary' => 1000, 'job_title' => 'HR Lead']);

        $this->actAs($supervisor)
            ->putJson(self::BASE . '/' . $supervisor->id, [
                'phone' => '0792222222',
                'salary' => 99999,
                'job_title' => 'King',
                'is_active' => false,
            ])
            ->assertOk();

        $fresh = $supervisor->fresh();
        $this->assertSame('0792222222', $fresh->phone);
        $this->assertEquals(1000, $fresh->salary);
        $this->assertSame('HR Lead', $fresh->job_title);
        $this->assertNull($fresh->archived_at);
    }

    /* ------------------------------------------------------------------
     | PUT /user/users/{user} : Normal HR
     |------------------------------------------------------------------ */

    public function test_normal_hr_has_full_edit_on_employee(): void
    {
        $target = $this->employee();

        $this->actAs($this->hr())
            ->putJson(self::BASE . '/' . $target->id, ['salary' => 3300, 'job_title' => 'Clerk', 'is_active' => false])
            ->assertOk();

        $fresh = $target->fresh();
        $this->assertEquals(3300, $fresh->salary);
        $this->assertSame('Clerk', $fresh->job_title);
        $this->assertNotNull($fresh->archived_at);
    }

    public function test_normal_hr_cannot_change_role_of_employee(): void
    {
        $target = $this->employee();

        $this->actAs($this->hr())
            ->putJson(self::BASE . '/' . $target->id, ['name' => 'Ok', 'role' => 'admin'])
            ->assertOk();

        $this->assertSame('employee', $target->fresh()->role);
    }

    public function test_normal_hr_cannot_edit_hr_or_admin(): void
    {
        $normalHr = $this->hr();

        foreach ([$this->hr(), $this->supervisor(), $this->admin()] as $target) {
            $this->actAs($normalHr)
                ->putJson(self::BASE . '/' . $target->id, ['name' => 'Hacked'])
                ->assertForbidden();

            $this->assertNotSame('Hacked', $target->fresh()->name);
        }
    }

    /**
     * KNOWN BUG: a normal HR user editing himself gets 403 because the target
     * role is "hr", not "employee". Your rule says he may edit his own personal fields.
     */
    public function test_normal_hr_can_edit_his_own_personal_fields_only(): void
    {
        $normalHr = $this->hr(['salary' => 1000]);

        $this->actAs($normalHr)
            ->putJson(self::BASE . '/' . $normalHr->id, ['phone' => '0793333333', 'salary' => 99999])
            ->assertOk();

        $fresh = $normalHr->fresh();
        $this->assertSame('0793333333', $fresh->phone);
        $this->assertEquals(1000, $fresh->salary);
    }

    /* ------------------------------------------------------------------
     | PUT /user/users/{user} : Employee
     |------------------------------------------------------------------ */

    public function test_employee_can_edit_own_personal_fields(): void
    {
        $me = $this->employee();

        $this->actAs($me)
            ->putJson(self::BASE . '/' . $me->id, ['phone' => '0794444444', 'address' => 'Amman'])
            ->assertOk();

        $this->assertSame('0794444444', $me->fresh()->phone);
        $this->assertSame('Amman', $me->fresh()->address);
    }

    public function test_employee_cannot_edit_someone_else(): void
    {
        $me = $this->employee();
        $other = $this->employee(['name' => 'Other']);

        $this->actAs($me)
            ->putJson(self::BASE . '/' . $other->id, ['name' => 'Hacked'])
            ->assertForbidden();

        $this->assertSame('Other', $other->fresh()->name);
    }

    public function test_employee_cannot_change_salary_or_role(): void
    {
        $me = $this->employee(['salary' => 1000]);

        // Only forbidden fields: nothing valid is left, so the request is rejected.
        $this->actAs($me)
            ->putJson(self::BASE . '/' . $me->id, ['salary' => 99999, 'role' => 'admin'])
            ->assertUnprocessable();

        $fresh = $me->fresh();
        $this->assertEquals(1000, $fresh->salary);
        $this->assertSame('employee', $fresh->role);
    }

    /* ------------------------------------------------------------------
     | PUT /user/users/{user} : general validation
     |------------------------------------------------------------------ */

    public function test_update_rejects_empty_body(): void
    {
        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $this->employee()->id, [])
            ->assertUnprocessable();
    }

    public function test_update_validates_fields(): void
    {
        $admin = $this->admin();
        $target = $this->employee();
        $taken = $this->employee(['email' => 'taken@example.com']);
        $url = self::BASE . '/' . $target->id;

        $this->actAs($admin)->putJson($url, ['email' => 'not-an-email'])
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);
        $this->actAs($admin)->putJson($url, ['email' => $taken->email])
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);
        $this->actAs($admin)->putJson($url, ['salary' => -5])
            ->assertUnprocessable()->assertJsonValidationErrors(['salary']);
        $this->actAs($admin)->putJson($url, ['role' => 'boss'])
            ->assertUnprocessable()->assertJsonValidationErrors(['role']);
        $this->actAs($admin)->putJson($url, ['department_id' => '11111111-1111-1111-1111-111111111111'])
            ->assertUnprocessable()->assertJsonValidationErrors(['department_id']);
        $this->actAs($admin)->putJson($url, ['hire_date' => now()->addDay()->toDateString()])
            ->assertUnprocessable()->assertJsonValidationErrors(['hire_date']);
    }

    public function test_user_can_keep_his_own_email_when_updating(): void
    {
        $me = $this->employee(['email' => 'keep@example.com']);

        $this->actAs($me)
            ->putJson(self::BASE . '/' . $me->id, ['email' => 'keep@example.com', 'phone' => '0795555555'])
            ->assertOk();
    }

    public function test_update_returns_404_for_unknown_user(): void
    {
        $this->actAs($this->admin())
            ->putJson(self::BASE . '/11111111-1111-1111-1111-111111111111', ['name' => 'X'])
            ->assertNotFound();
    }

    /* ------------------------------------------------------------------
     | PUT /user/users/{user} : department head rules
     |------------------------------------------------------------------ */

    public function test_can_make_an_hr_user_head_of_his_department(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => $dept->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['is_head_of_department' => true])
            ->assertOk();

        $this->assertSame($hr->id, $dept->fresh()->head_id);
    }

    public function test_head_needs_a_department(): void
    {
        $hr = $this->hr(['department_id' => null]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['is_head_of_department' => true])
            ->assertUnprocessable();
    }

    public function test_head_can_be_set_together_with_a_new_department(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => null]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, [
                'department_id' => $dept->id,
                'is_head_of_department' => true,
            ])
            ->assertOk();

        $this->assertSame($hr->id, $dept->fresh()->head_id);
    }

    public function test_only_hr_can_be_head(): void
    {
        $dept = $this->department();
        $employee = $this->employee(['department_id' => $dept->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $employee->id, ['is_head_of_department' => true])
            ->assertUnprocessable();

        $this->assertNull($dept->fresh()->head_id);
    }

    public function test_archived_user_cannot_be_made_head(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => $dept->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['is_head_of_department' => true, 'is_active' => false])
            ->assertUnprocessable();

        $this->assertNull($dept->fresh()->head_id);
    }

    /**
     * A user who is already archived must not become head, even when the
     * request does not send is_active.
     */
    public function test_already_archived_user_cannot_be_made_head(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => $dept->id, 'archived_at' => now()]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['is_head_of_department' => true])
            ->assertUnprocessable();

        $this->assertNull($dept->fresh()->head_id);
    }

    public function test_head_flag_false_removes_head_assignment(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => $dept->id]);
        Department::where('id', $dept->id)->update(['head_id' => $hr->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['is_head_of_department' => false])
            ->assertOk();

        $this->assertNull($dept->fresh()->head_id);
    }

    public function test_changing_department_removes_old_head_assignment(): void
    {
        $old = $this->department();
        $new = $this->department();
        $hr = $this->hr(['department_id' => $old->id]);
        Department::where('id', $old->id)->update(['head_id' => $hr->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['department_id' => $new->id])
            ->assertOk();

        $this->assertNull($old->fresh()->head_id);
        $this->assertNull($new->fresh()->head_id);
    }

    public function test_archiving_a_head_removes_head_assignment(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => $dept->id]);
        Department::where('id', $dept->id)->update(['head_id' => $hr->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['is_active' => false])
            ->assertOk();

        $this->assertNull($dept->fresh()->head_id);
    }

    public function test_changing_role_away_from_hr_removes_head_assignment(): void
    {
        $dept = $this->department();
        $hr = $this->hr(['department_id' => $dept->id]);
        Department::where('id', $dept->id)->update(['head_id' => $hr->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, ['role' => 'employee'])
            ->assertOk();

        $this->assertNull($dept->fresh()->head_id);
    }

    public function test_making_head_of_new_department_clears_previous_one(): void
    {
        $first = $this->department();
        $second = $this->department();
        $hr = $this->hr(['department_id' => $first->id]);
        Department::where('id', $first->id)->update(['head_id' => $hr->id]);

        $this->actAs($this->admin())
            ->putJson(self::BASE . '/' . $hr->id, [
                'department_id' => $second->id,
                'is_head_of_department' => true,
            ])
            ->assertOk();

        $this->assertNull($first->fresh()->head_id);
        $this->assertSame($hr->id, $second->fresh()->head_id);
    }

    /* ------------------------------------------------------------------
     | Own profile: same rule for every role (data provider)
     |------------------------------------------------------------------ */

    public static function everyActor(): array
    {
        return [
            'admin' => ['admin', false],
            'normal hr' => ['hr', false],
            'supervisor hr' => ['hr', true],
            'employee' => ['employee', false],
        ];
    }

    // KNOWN BUG for "normal hr" (403) and "supervisor hr" (full edit).
    #[DataProvider('everyActor')]
    public function test_every_role_can_update_own_phone_and_address(string $role, bool $supervisor): void
    {
        $me = $this->actor($role, $supervisor);

        $this->actAs($me)
            ->putJson(self::BASE . '/' . $me->id, ['phone' => '0796666666', 'address' => 'Somewhere'])
            ->assertOk();

        $this->assertSame('0796666666', $me->fresh()->phone);
    }

    // KNOWN BUG for "normal hr" (403) and "supervisor hr" (salary changes).
    #[DataProvider('everyActor')]
    public function test_no_role_can_change_own_salary(string $role, bool $supervisor): void
    {
        $me = $this->actor($role, $supervisor);
        $me->update(['salary' => 1000]);

        $this->actAs($me)
            ->putJson(self::BASE . '/' . $me->id, ['salary' => 99999]);

        $this->assertEquals(1000, $me->fresh()->salary);
    }


}