#!/usr/bin/env node
/**
 * NorthStar CLI — Initialize a project for NorthStar tracking.
 *
 * Usage:
 *   npx north-star-mcp init              # Initialize in current directory
 *   npx north-star-mcp init ./my-project # Initialize in specific directory
 */

import { promises as fs } from 'fs';
import path from 'path';

const NORTH_STAR_DIR = '.north-star';

const DEFAULT_PLAN = {
  id: `plan-${Date.now()}`,
  name: '',
  vision: '',
  successCriteria: [],
  constraints: [],
  phases: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schemaVersion: '1.0.0',
};

async function init(targetDir: string) {
  const absoluteDir = path.resolve(targetDir);
  const northStarPath = path.join(absoluteDir, NORTH_STAR_DIR);
  const projectName = path.basename(absoluteDir);

  console.log(`\n⭐ NorthStar — Project Initializer\n`);
  console.log(`  Project: ${projectName}`);
  console.log(`  Path:    ${absoluteDir}`);
  console.log(`  Data:    ${northStarPath}\n`);

  // Check if already initialized
  try {
    await fs.access(northStarPath);
    console.log(`⚠️  Already initialized. ${northStarPath} exists.`);
    console.log(`  To reinitialize, delete the .north-star directory first.\n`);
    process.exit(1);
  } catch {
    // Good — directory doesn't exist yet
  }

  // Create .north-star directory
  await fs.mkdir(northStarPath, { recursive: true });

  // Create empty plan with project name pre-filled
  const plan = {
    ...DEFAULT_PLAN,
    name: projectName,
    vision: `[TODO: Define the vision for ${projectName}]`,
    successCriteria: ['[TODO: Define what "done" looks like]'],
    phases: [
      {
        id: `${Date.now()}-phase1`,
        name: 'Phase 1: Getting Started',
        objective: '[TODO: Define the first phase objective]',
        deliverables: ['[TODO: List deliverables]'],
        status: 'active',
        milestones: [
          {
            id: `${Date.now()}-ms1`,
            description: '[TODO: First milestone]',
            acceptanceCriteria: ['[TODO: Define acceptance criteria]'],
            status: 'pending',
            blockers: [],
          },
        ],
      },
    ],
  };

  await fs.writeFile(path.join(northStarPath, 'master-plan.json'), JSON.stringify(plan, null, 2));

  // Create empty data files
  await fs.writeFile(path.join(northStarPath, 'decisions.json'), '[]');
  await fs.writeFile(path.join(northStarPath, 'rules.json'), '[]');
  await fs.writeFile(path.join(northStarPath, 'scratchpad.json'), '[]');

  // Create .gitignore for logs
  await fs.writeFile(path.join(northStarPath, '.gitignore'), '*.log\narchives/\n');

  console.log(`✅ Initialized NorthStar in ${northStarPath}\n`);
  console.log(`  Created files:`);
  console.log(`    • master-plan.json    (template plan — customize with init_master_plan tool)`);
  console.log(`    • decisions.json      (empty decision log)`);
  console.log(`    • rules.json          (empty rules)`);
  console.log(`    • scratchpad.json     (empty scratchpad)`);
  console.log(`    • .gitignore          (excludes logs and archives)\n`);
  console.log(`  Next steps:`);
  console.log(`    1. Open this project in Antigravity`);
  console.log(`    2. Ask the agent to run "init_master_plan" to set up your real plan`);
  console.log(`    3. The dashboard at http://localhost:9889 will auto-discover this project\n`);
}

// Parse CLI args
const args = process.argv.slice(2);
const command = args[0];
const target = args[1] || '.';

if (command === 'init') {
  init(target).catch((err) => {
    console.error('❌ Failed to initialize:', err.message);
    process.exit(1);
  });
} else {
  console.log(`\n⭐ NorthStar CLI\n`);
  console.log(`  Commands:`);
  console.log(`    init [path]   Initialize NorthStar in a project directory\n`);
  console.log(`  Examples:`);
  console.log(`    npx north-star-mcp init`);
  console.log(`    npx north-star-mcp init ./my-project\n`);
}
