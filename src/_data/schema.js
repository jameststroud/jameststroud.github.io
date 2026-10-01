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
  const profileUrl = site.url + "/james-stroud/";
  const clean = (s) => String(s || "").replace(/,?\s*Ph\.?D\.?$/i, "").trim();
  const org = (name, url) => ({ "@type": "CollegeOrUniversity", name, url });

  // The home page is the "home" of this Person for Google's Knowledge Graph;
  // /james-stroud/ is a ProfilePage about the same Person. Every name form he
  // publishes under goes in alternateName, and every profile elsewhere goes in
  // sameAs, so that searches on any of them resolve to the same person.
  const piNode = {
    "@type": "Person",
    "@id": piId,
    name: clean(pi.name),
    alternateName: ["James Stroud", "J.T. Stroud", "Dr. James Stroud"],
    givenName: "James",
    familyName: "Stroud",
    jobTitle: pi.role,
    description: "Evolutionary ecologist studying lizard evolution and ecology",
    hasOccupation: { "@type": "Occupation", name: "Evolutionary ecologist" },
    email: pi.email ? "mailto:" + pi.email : undefined,
    image: pi.photo ? site.url + "/assets/img/people/" + pi.photo : undefined,
    url: site.url + "/",
    worksFor: [
      { "@id": labId },
      org("Georgia Institute of Technology", "https://www.gatech.edu/"),
    ],
    affiliation: { "@type": "Organization", name: "Georgia Institute of Technology", url: "https://www.gatech.edu/" },
    alumniOf: [
      org("Florida International University", "https://www.fiu.edu/"),
      org("University of Hull"),
      org("University of Wales"),
    ],
    knowsAbout: [
      "Evolutionary ecology", "Lizards", "Anolis", "Community ecology",
      "Natural selection", "Adaptive radiation", "Invasive species", "Thermal ecophysiology",
    ],
    award: pi.awards,
    identifier: site.orcid ? { "@type": "PropertyValue", propertyID: "ORCID", value: site.orcid } : undefined,
    sameAs: [
      site.orcid && "https://orcid.org/" + site.orcid,
      pi.scholar || site.scholar,
      site.gatechProfile,
      site.wikidata,
      site.x,
      site.bluesky,
      site.conversation,
      site.researchgate,
      site.github,
    ].filter(Boolean),
  };

  return {
    labId,
    piId,
    profileUrl,
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
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "media relations",
            email: site.email,
            name: clean(pi.name),
          },
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
