
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  initializeMobileMenu();
  initializeFAQ();
  initializeNavbar();
  initializeScrollAnimations();
  updateCopyrightYear();
});

// =========================
// 1. Mobile Navigation
// =========================

function initializeMobileMenu() {
  const menuButton = document.getElementById("mobileMenuBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const menuIcon = document.getElementById("menuIcon");
  const closeIcon = document.getElementById("closeIcon");

  if (!menuButton || !mobileMenu || !menuIcon || !closeIcon) {
    return;
  }

  function closeMenu() {
    mobileMenu.hidden = true;
    menuIcon.classList.remove("hidden");
    closeIcon.classList.add("hidden");
    menuButton.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const shouldOpen = mobileMenu.hidden;

    mobileMenu.hidden = !shouldOpen;
    menuIcon.classList.toggle("hidden", shouldOpen);
    closeIcon.classList.toggle("hidden", !shouldOpen);

    menuButton.setAttribute("aria-expanded", String(shouldOpen));
  }

  menuButton.addEventListener("click", toggleMenu);

  // Close the menu after selecting a section.
  document.querySelectorAll(".mobile-link").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Close the menu with Escape.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  // Close the mobile menu when returning to desktop width.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 767) {
      closeMenu();
    }
  });
}

// =========================
// 2. FAQ Accordion
// =========================

function initializeFAQ() {
  const faqButtons = document.querySelectorAll(".faq-btn");

  faqButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const answer = button.nextElementSibling;

      if (!answer || !answer.classList.contains("faq-answer")) {
        return;
      }

      const isExpanded =
        button.getAttribute("aria-expanded") === "true";

      // Close every FAQ item.
      faqButtons.forEach((otherButton) => {
        otherButton.setAttribute("aria-expanded", "false");

        const otherAnswer = otherButton.nextElementSibling;

        if (otherAnswer) {
          otherAnswer.hidden = true;
        }
      });

      // Open the clicked item if it was previously closed.
      if (!isExpanded) {
        button.setAttribute("aria-expanded", "true");
        answer.hidden = false;
      }
    });
  });
}

// =========================
// 3. Sticky Navbar
// =========================

function initializeNavbar() {
  const navbar = document.getElementById("navbar");

  if (!navbar) {
    return;
  }

  function updateNavbar() {
    navbar.classList.toggle("scrolled", window.scrollY > 20);
  }

  window.addEventListener("scroll", updateNavbar, {
    passive: true
  });

  // Set the correct state when the page loads.
  updateNavbar();
}

// =========================
// 4. Scroll Animations
// =========================

function initializeScrollAnimations() {
  const elements = document.querySelectorAll(".reveal");

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Show everything immediately if animations are disabled.
  if (
    prefersReducedMotion ||
    !("IntersectionObserver" in window)
  ) {
    elements.forEach((element) => {
      element.classList.add("visible");
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");

          // Stop observing after the animation runs.
          currentObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  elements.forEach((element) => {
    observer.observe(element);
  });
}

// =========================
// 5. Copyright Year
// =========================

function updateCopyrightYear() {
  const yearElement = document.getElementById("currentYear");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}
