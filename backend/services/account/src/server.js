const app = require('./app');

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`[eearny] account service listening on http://localhost:${PORT}`);
});
