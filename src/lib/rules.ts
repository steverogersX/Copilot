import rulesJson from "./rules.json";
import { rulesSchema } from "./rules.schema";

// Parsed at module load time so a malformed config fails loudly and
// immediately, not deep inside a calculation.
export const rules = rulesSchema.parse(rulesJson);
