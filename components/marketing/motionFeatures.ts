/* Motion features, split into their own chunk so LazyMotion consumers
   (hero proof, bento entrances, KPI demo) never put animation code in
   the critical bundle. domMax because the hero/demo use layout FLIP. */
export { domMax as default } from "motion/react";
