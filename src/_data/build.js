module.exports = () => ({
  year: new Date().getFullYear(),
  date: new Date().toISOString().slice(0, 10),
});
