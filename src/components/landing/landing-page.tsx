"use client";

import { useEffect } from "react";

import { landingBodyHtml } from "@/components/landing/landing-content";

import "./landing.css";

export function LandingPage() {
  useEffect(() => {
    const faqItems = Array.from(document.querySelectorAll<HTMLElement>(".faq-item"));

    const handleFaqClick = (event: Event) => {
      const target = event.currentTarget as HTMLElement | null;
      if (!target) {
        return;
      }

      const item = target.closest(".faq-item");
      if (!item) {
        return;
      }

      const wasOpen = item.classList.contains("open");
      faqItems.forEach((faqItem) => faqItem.classList.remove("open"));
      if (!wasOpen) {
        item.classList.add("open");
      }
    };

    const faqQuestions = Array.from(
      document.querySelectorAll<HTMLElement>("[data-faq-toggle]"),
    );
    faqQuestions.forEach((question) => {
      question.addEventListener("click", handleFaqClick);
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    const revealElements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    revealElements.forEach((element) => revealObserver.observe(element));

    const anchorLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
    );
    const handleAnchorClick = (event: Event) => {
      const anchor = event.currentTarget as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href === "#") {
        return;
      }

      const section = document.querySelector(href);
      if (!section) {
        return;
      }

      event.preventDefault();
      const offset = 70;
      const top = section.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: "smooth" });
    };

    anchorLinks.forEach((anchor) => {
      anchor.addEventListener("click", handleAnchorClick);
    });

    return () => {
      faqQuestions.forEach((question) => {
        question.removeEventListener("click", handleFaqClick);
      });
      revealObserver.disconnect();
      anchorLinks.forEach((anchor) => {
        anchor.removeEventListener("click", handleAnchorClick);
      });
    };
  }, []);

  return (
    <div
      className="landing-page"
      dangerouslySetInnerHTML={{ __html: landingBodyHtml }}
    />
  );
}
