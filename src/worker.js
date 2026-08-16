const config = require('./config');
const { runOne } = require('./services/processor');
let active = true;
process.on('SIGTERM', () => { active = false; });
(async function loop() { while (active) { const worked = await runOne(); if (!worked) await new Promise(r => setTimeout(r, config.workerPollMs)); } })();
