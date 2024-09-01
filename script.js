// Smooth scrolling for nav links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelector(this.getAttribute('href')).scrollIntoView({
        behavior: 'smooth'
      });
    });
  });
  
  // Dynamically change header and nav background on scroll
  window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
      header.style.backgroundColor = '#0d47a1';
      nav.style.backgroundColor = '#333';
    } else {
      header.style.backgroundColor = '#1565c0';
      nav.style.backgroundColor = '#444';
    }
  
    // Reveal sections on scroll
    document.querySelectorAll('.main').forEach(section => {
      const sectionTop = section.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      if (sectionTop < windowHeight - 50) {
        section.classList.add('visible');
      }
    });
  });
  