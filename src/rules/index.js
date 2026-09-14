import closeDuplicates from './closeDuplicates.js';
import groupStale from './groupStale.js';
import discardStale from './discardStale.js';
import groupBySite from './groupBySite.js';

// Add a rule: create src/rules/<name>.js exporting { id, name, description, triggers, run(ctx) }
// and list it here. Triggers: 'url-changed' | 'tab-created' | 'tab-removed' | 'alarm' (hourly) | 'manual'.
export const rules = [closeDuplicates, groupStale, groupBySite, discardStale];
