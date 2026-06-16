import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { backfillTcgdexPricing } from "../src/lib/pokewallet/tcgdex-pricing";
(async()=>{
  const r=await backfillTcgdexPricing({ limit: 300 });
  console.log(`Gecheckt: ${r.checked}  Geprijsd via TCGdex: ${r.priced}\n`);
  for(const c of r.pricedCards) console.log(`  ✓ ${c.id.padEnd(14)} €${(c.avg??0).toFixed(2).padStart(8)}  ${c.name}`);
  await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
