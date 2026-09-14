import closeDuplicates from './closeDuplicates.js';

// Add a rule: create src/rules/<name>.js exporting { id, name, description, triggers, run(ctx) }
// and list it here. Triggers: 'url-changed' | 'tab-created' | 'tab-removed' | 'manual'.
export const rules = [closeDuplicates];
