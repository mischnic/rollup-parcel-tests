import { foo } from "./b.js";

globalThis.output = import("./c.js");

export const main = foo + 2;
