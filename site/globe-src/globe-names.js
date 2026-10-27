// Saved identifiers remain unchanged. Only their old ordinal display suffix
// is removed; catalogue numbers and digits inside a user name are retained.
export function celestialDisplayName(name,id){
  const ordinal=/^(?:moon|planet)-([1-8])$/.exec(id);
  const suffix=/^(.*?)[·-]\s*([0-9]+|[IVX]+|[ⅠⅡⅢⅣⅤⅥⅦⅧ]+)\s*$/i.exec(name);
  if(!ordinal||!suffix)return name;
  const index=Number(ordinal[1]),number=suffix[2].normalize('NFKC').toUpperCase();
  const prefix=suffix[1].trimEnd();
  return prefix&&(number===String(index)||number===['I','II','III','IV','V','VI','VII','VIII'][index-1])
    ?prefix:name;
}
