module.exports = () => ({
  year: new Date().getFullYear(),
  // Full ISO 8601 date-time with time zone, as Google requires for dateModified.
  datetime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
});
