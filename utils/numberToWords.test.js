/**
 * Tests pour la fonction numberToWords
 * Exécuter avec: node utils/numberToWords.test.js
 */
const { numberToWords } = require('./numberToWords');

const testCases = [
  // Cas de base
  { input: 0, expected: 'Zéro' },
  { input: 1, expected: 'Un' },
  { input: 10, expected: 'Dix' },
  { input: 11, expected: 'Onze' },
  { input: 20, expected: 'Vingt' },
  { input: 21, expected: 'Vingt-et-un' },
  { input: 30, expected: 'Trente' },
  { input: 50, expected: 'Cinquante' },
  
  // Cas problématiques 70-79
  { input: 70, expected: 'Soixante-dix' },
  { input: 71, expected: 'Soixante-et-onze' },
  { input: 72, expected: 'Soixante-douze' },
  { input: 73, expected: 'Soixante-treize' },
  { input: 74, expected: 'Soixante-quatorze' },
  { input: 75, expected: 'Soixante-quinze' },
  { input: 76, expected: 'Soixante-seize' },
  { input: 77, expected: 'Soixante-dix-sept' },
  { input: 78, expected: 'Soixante-dix-huit' },
  { input: 79, expected: 'Soixante-dix-neuf' },
  
  // Cas problématiques 90-99
  { input: 90, expected: 'Quatre-vingt-dix' },
  { input: 91, expected: 'Quatre-vingt-onze' }, // Note: sans "et" contrairement à 71
  { input: 92, expected: 'Quatre-vingt-douze' },
  { input: 93, expected: 'Quatre-vingt-treize' },
  { input: 94, expected: 'Quatre-vingt-quatorze' },
  { input: 95, expected: 'Quatre-vingt-quinze' },
  { input: 96, expected: 'Quatre-vingt-seize' },
  { input: 97, expected: 'Quatre-vingt-dix-sept' },
  { input: 98, expected: 'Quatre-vingt-dix-huit' },
  { input: 99, expected: 'Quatre-vingt-dix-neuf' },
  
  // Centaines
  { input: 100, expected: 'Cent' },
  { input: 101, expected: 'Cent un' },
  { input: 200, expected: 'Deux cents' },
  { input: 500, expected: 'Cinq cents' },
  { input: 700, expected: 'Sept cents' },
  
  // Milliers
  { input: 1000, expected: 'Mille' },
  { input: 2000, expected: 'Deux mille' },
  { input: 5000, expected: 'Cinq mille' },
  { input: 10000, expected: 'Dix mille' },
  { input: 50000, expected: 'Cinquante mille' },
  { input: 70000, expected: 'Soixante-dix mille' },
  { input: 73000, expected: 'Soixante-treize mille' },
  { input: 73500, expected: 'Soixante-treize mille cinq cents' },
  { input: 72500, expected: 'Soixante-douze mille cinq cents' },
  { input: 90000, expected: 'Quatre-vingt-dix mille' },
  { input: 95000, expected: 'Quatre-vingt-quinze mille' },
  
  // Cas complexes
  { input: 73501, expected: 'Soixante-treize mille cinq cent un' },
  { input: 73510, expected: 'Soixante-treize mille cinq cent dix' },
  { input: 73520, expected: 'Soixante-treize mille cinq cent vingt' },
  { input: 73530, expected: 'Soixante-treize mille cinq cent trente' },
  { input: 73540, expected: 'Soixante-treize mille cinq cent quarante' },
  { input: 73550, expected: 'Soixante-treize mille cinq cent cinquante' },
  { input: 73560, expected: 'Soixante-treize mille cinq cent soixante' },
  { input: 73570, expected: 'Soixante-treize mille cinq cent soixante-dix' },
  { input: 73580, expected: 'Soixante-treize mille cinq cent quatre-vingts' },
  { input: 73590, expected: 'Soixante-treize mille cinq cent quatre-vingt-dix' },
  { input: 73600, expected: 'Soixante-treize mille six cents' },
  
  // Millions
  { input: 1000000, expected: 'Un million' },
  { input: 2000000, expected: 'Deux millions' },
  { input: 7350000, expected: 'Sept millions trois cent cinquante mille' },
];

let passed = 0;
let failed = 0;
const failures = [];

console.log('🧪 Tests de la fonction numberToWords\n');
console.log('='.repeat(80));

testCases.forEach(({ input, expected }) => {
  const result = numberToWords(input);
  const success = result === expected;
  
  if (success) {
    passed++;
    console.log(`✅ ${input.toString().padStart(10)} -> ${result}`);
  } else {
    failed++;
    failures.push({ input, expected, got: result });
    console.log(`❌ ${input.toString().padStart(10)} -> ${result}`);
    console.log(`   Attendu: ${expected}`);
  }
});

console.log('='.repeat(80));
console.log(`\n📊 Résultats: ${passed} réussis, ${failed} échoués`);

if (failures.length > 0) {
  console.log('\n❌ Échecs détectés:');
  failures.forEach(({ input, expected, got }) => {
    console.log(`   ${input}: attendu "${expected}", obtenu "${got}"`);
  });
  process.exit(1);
} else {
  console.log('\n✅ Tous les tests sont passés !');
  process.exit(0);
}
