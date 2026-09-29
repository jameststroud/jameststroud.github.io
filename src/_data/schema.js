// Structured data (schema.org JSON-LD) describing the lab and its PI. Search
// engines read this to understand the site; visitors never see it. Everything
// here comes from site.json and people.yaml, so edit those rather than this.
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

module.exports = () => {
  const site = require("./site.json");
  const people = yaml.load(fs.readFileSync(path.join(__dirname, "people.yaml"), "utf8")) || [];
  const pi = people.find((p) => p.group === "pi") || {};
  const current = people.filter((p) => !["pi", "alumni", "incoming"].includes(p.group));

  const labId = site.url + "/#lab";
  const piId = site.url + "/people/#pi";
  const clean = (s) => String(s || "").replace(/,?\s*Ph\.?D\.?$/i, "").trim();

  const piNode = {
    "@type": "Person",
    "@id": piId,
    name: clean(pi.name),
    jobTitle: /Assistant Professor/.test(pi.bio || "") ? "Assistant Professor" : pi.role,
    email: pi.email ? "mailto:" + pi.email : undefined,
    image: pi.photo ? site.url + "/assets/img/people/" + pi.photo : undefined,
    url: site.url + "/people/",
    worksFor: { "@id": labId },
    affiliation: { "@type": "CollegeOrUniversity", name: "Georgia Institute of Technology" },
    identifier: site.orcid ? { "@type": "PropertyValue", propertyID: "ORCID", value: site.orcid } : undefined,
    sameAs: [
      site.orcid && "https://orcid.org/" + site.orcid,
      pi.scholar || site.scholar,
      site.researchgate,
      site.github,
    ].filter(Boolean),
  };

  return {
    labId,
    piId,
    graph: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": site.url + "/#website",
          url: site.url + "/",
          name: site.title,
          description: site.tagline,
          publisher: { "@id": labId },
          inLanguage: "en",
        },
        {
          "@type": "ResearchOrganization",
          "@id": labId,
          name: site.title,
          alternateName: "Stroud Lab",
          description: site.tagline,
          url: site.url + "/",
          logo: site.url + "/assets/img/logo@2x.png",
          email: "mailto:" + site.email,
          address: {
            "@type": "PostalAddress",
            streetAddress: site.address[2],
            addressLocality: "Atlanta",
            addressRegion: "GA",
            postalCode: "30332",
            addressCountry: "US",
          },
          parentOrganization: {
            "@type": "Organization",
            name: "School of Biological Sciences",
            parentOrganization: { "@type": "CollegeOrUniversity", name: "Georgia Institute of Technology", url: "https://www.gatech.edu/" },
          },
          founder: { "@id": piId },
          member: [{ "@id": piId }].concat(
            current.map((p) => ({ "@type": "Person", name: clean(p.name), jobTitle: p.role }))
          ),
          sameAs: [site.github].filter(Boolean),
        },
        piNode,
      ],
    },
  };
};
