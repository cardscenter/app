// Spelersprofiel (Community Hub, Fase 2): nieuwe URL voor het publieke
// profiel. De pagina zelf leeft nog in verkoper/[userId] (handel-tabs staan
// daar al achter de feature-flags); /verkoper/<id> stuurt met 308 hierheen.
export { default, generateMetadata } from "../../verkoper/[userId]/page";
