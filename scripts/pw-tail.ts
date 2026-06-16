import "dotenv/config";
import { prisma } from "../src/lib/prisma";
function priceless(c:any){return c.priceAvg==null&&c.priceAvg7==null&&c.priceTrend==null&&c.priceTcgplayerNormalMarket==null&&c.priceTcgplayerHolofoilMarket==null;}
(async()=>{
  // tcgdexIds van de remap-targets
  for(const n of ["Black & White","Celebrations","Wizards Black Star Promos"]){
    const s=await prisma.cardSet.findFirst({where:{name:n},select:{name:true,tcgdexSetId:true,pokewalletSetId:true,_count:{select:{cards:true}}}});
    console.log(`${n}: tcgdex=${s?.tcgdexSetId} pw=${s?.pokewalletSetId} cards=${s?._count.cards}`);
  }
  console.log("\n── Alle resterende prijsloze kaarten (de staart) ──");
  const sets=await prisma.cardSet.findMany({where:{cards:{some:{}}},select:{name:true,pokewalletSetId:true,
    cards:{select:{name:true,localId:true,rarity:true,priceAvg:true,priceAvg7:true,priceTrend:true,priceTcgplayerNormalMarket:true,priceTcgplayerHolofoilMarket:true}}}});
  let n=0;
  for(const s of sets){
    const pl=s.cards.filter(priceless);
    if(pl.length===0)continue;
    n+=pl.length;
    console.log(`\n${s.name} (pw=${s.pokewalletSetId}) — ${pl.length}:`);
    console.log("   "+pl.map(c=>`${c.localId}=${c.name}${c.rarity?`[${c.rarity}]`:""}`).join(" · "));
  }
  console.log(`\nTotaal resterend prijsloos: ${n}`);
  await prisma.$disconnect();
})();
