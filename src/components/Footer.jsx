function Footer() {
  const logos = [
    {
      href: "https://www2.isep.ipp.pt/softcps/",
      label: "SoftCPS",
      src: "/logos/softcps.png",
      className: "footer-logo-softcps",
    },
    {
      href: "https://www.isep.ipp.pt/",
      label: "ISEP",
      src: "/logos/ISEP-light.png",
      className: "footer-logo-isep",
    },
    {
      href: "https://www.portugal.gov.pt/pt/gc25",
      label: "Portuguese Republic",
      src: "/logos/Digital_RP_4C.svg",
      className: "footer-logo-digital",
    },
    {
      href: "https://www.fct.pt/",
      label: "FCT",
      src: "/logos/fct_light.jpg",
      className: "footer-logo-fct",
    },
    {
      href: "https://portugal2030.pt/",
      label: "Portugal 2030",
      src: "/logos/PRD_PDQI(1).png",
      className: "footer-logo-prd",
    },
    {
      href: "https://www.i-charging.pt/",
      label: "i-charging",
      src: "/logos/logo_i_charging_dark.png",
      className: "footer-logo-icharging",
    },
  ];

  return (
    <footer className="institutional-footer" aria-label="Institutional partners">
      <div className="institutional-copy">
        <p>
          Developed by <strong>Tiago Fonseca</strong>.
        </p>
        <p>
          Funded by DEMFLEX, supported by FCT - Fundacao para a Ciencia e a Tecnologia under grant
          2024.00855.BD.
        </p>
      </div>

      <div className="institutional-logos">
        {logos.map((logo) => (
          <a
            key={logo.label}
            href={logo.href}
            target="_blank"
            rel="noreferrer"
            aria-label={logo.label}
          >
            <img
              className={`institutional-logo ${logo.className}`}
              src={logo.src}
              alt=""
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </footer>
  );
}

function GitHubMark({ size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      focusable="false"
      {...props}
    >
      <path d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.1.79-.25.79-.56v-2c-3.22.7-3.9-1.38-3.9-1.38-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.73 0-1.27.45-2.3 1.2-3.11-.12-.29-.52-1.48.11-3.07 0 0 .98-.31 3.2 1.19a11.1 11.1 0 0 1 5.82 0c2.22-1.5 3.2-1.19 3.2-1.19.63 1.59.23 2.78.11 3.07.75.81 1.2 1.84 1.2 3.11 0 4.45-2.71 5.43-5.29 5.72.42.36.8 1.08.8 2.18v3.24c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export { Footer, GitHubMark };
