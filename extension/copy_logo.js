const fs = require('fs');
const path = require('path');

const source = 'C:\\Users\\JORY\\.gemini\\antigravity\\brain\\3223f1c1-5694-42a3-a868-b96ddd99ac09\\oryx_solver_logo_v2_1773089806042.png';
const targets = [
  'd:\\codes\projects\\OryxSolver\\extension\\public\\icons\\oryx_v2_128.png',
  'd:\\codes\\projects\\OryxSolver\\extension\\public\\icons\\128.png',
  'd:\\codes\\projects\\OryxSolver\\extension\\public\\icons\\48.png',
  'd:\\codes\\projects\\OryxSolver\\extension\\public\\icons\\16.png'
];

targets.forEach((target) => {
  try {
    fs.copyFileSync(source, target);
    console.log(`Copied from ${source} to ${target}`);
  } catch (err) {
    console.error(`Failed to copy to ${target}: ${err.message}`);
  }
});
