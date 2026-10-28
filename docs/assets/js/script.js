document.addEventListener("DOMContentLoaded", () => {
    const spinner = document.getElementById("loading-spinner");
    if (spinner) {
        setTimeout(() => {
            spinner.classList.add("fade-out");
        }, 300);
    }

    const themeToggle = document.getElementById("theme-toggle");
    const htmlElement = document.documentElement;
    const themeIcon = themeToggle ? themeToggle.querySelector("i") : null;

    const savedTheme = localStorage.getItem("theme") || "dark";
    htmlElement.setAttribute("data-bs-theme", savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const currentTheme = htmlElement.getAttribute("data-bs-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            htmlElement.setAttribute("data-bs-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeIcon) return;
        if (theme === "light") {
            themeIcon.className = "fa-solid fa-sun";
        } else {
            themeIcon.className = "fa-solid fa-moon";
        }
    }

    const typedTextSpan = document.querySelector(".typed-text");
    const textArray = ["AI Engineer", "Software Developer", "Computer Science Student", "Problem Solver"];
    let textArrayIndex = 0;
    let charIndex = 0;

    function type() {
        if (!typedTextSpan) return;
        if (charIndex < textArray[textArrayIndex].length) {
            typedTextSpan.textContent += textArray[textArrayIndex].charAt(charIndex);
            charIndex++;
            setTimeout(type, 100);
        } else {
            setTimeout(erase, 2000);
        }
    }

    function erase() {
        if (!typedTextSpan) return;
        if (charIndex > 0) {
            typedTextSpan.textContent = textArray[textArrayIndex].substring(0, charIndex - 1);
            charIndex--;
            setTimeout(erase, 50);
        } else {
            textArrayIndex = (textArrayIndex + 1) % textArray.length;
            setTimeout(type, 500);
        }
    }

    if (typedTextSpan) {
        setTimeout(type, 1000);
    }

    const animatedElements = document.querySelectorAll(".animate-on-scroll");
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    animatedElements.forEach(el => observer.observe(el));

    const counters = document.querySelectorAll(".counter");
    let counted = false;

    window.addEventListener("scroll", () => {
        const scrollPos = window.scrollY + window.innerHeight;
        const targetSection = document.querySelector("#home");
        if (targetSection && scrollPos >= targetSection.offsetTop && !counted) {
            counters.forEach(counter => {
                const target = parseFloat(counter.getAttribute("data-target"));
                let count = 0;
                const speed = 50;
                const increment = target / speed;

                const updateCount = () => {
                    count += increment;
                    if (count < target) {
                        counter.textContent = count.toFixed(target % 1 !== 0 ? 2 : 0);
                        setTimeout(updateCount, 30);
                    } else {
                        counter.textContent = target;
                    }
                };
                updateCount();
            });
            counted = true;
        }
    });

    const backToTopBtn = document.getElementById("back-to-top");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            backToTopBtn.style.display = "flex";
        } else {
            backToTopBtn.style.display = "none";
        }
    });

    if (backToTopBtn) {
        backToTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    const navLinks = document.querySelectorAll(".navbar-nav .nav-link");
    window.addEventListener("scroll", () => {
        let current = "";
        const sections = document.querySelectorAll("section");
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= sectionTop - 150) {
                current = section.getAttribute("id");
            }
        });

        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === "#" + current) {
                link.classList.add("active");
            }
        });
    });
});