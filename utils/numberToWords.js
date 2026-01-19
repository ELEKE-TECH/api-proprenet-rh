/**
 * Convertit un nombre en lettres (français)
 * Exemple: 784167 -> "Sept cent quatre vingt quatre mille cent soixante sept"
 * 
 * Gère correctement les nombres 70-79 et 90-99 :
 * - 73 -> "soixante-treize" (pas "soixante-douze")
 * - 73500 -> "Soixante-treize mille cinq cents"
 */
function numberToWords(num) {
  if (num === 0) return 'Zéro';
  
  // Validation et normalisation
  if (typeof num !== 'number' || isNaN(num)) {
    throw new Error(`Nombre invalide: ${num}`);
  }
  
  // S'assurer que le nombre est un entier positif
  num = Math.floor(Math.abs(num));
  
  if (num < 0) {
    throw new Error(`Le nombre ne peut pas être négatif: ${num}`);
  }
  
  const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  function convertLessThanThousand(n) {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const tensPlace = Math.floor(n / 10);
      const onesPlace = n % 10;
      if (tensPlace === 7 || tensPlace === 9) {
        // Soixante-dix (70), quatre-vingt-dix (90)
        const base = tensPlace === 7 ? 'soixante' : 'quatre-vingt';
        if (onesPlace === 0) {
          return base === 'soixante' ? 'soixante-dix' : 'quatre-vingt-dix';
        }
        if (onesPlace === 1) {
          // 71 = soixante-et-onze (avec "et")
          // 91 = quatre-vingt-onze (sans "et")
          return tensPlace === 7 ? `${base}-et-onze` : `${base}-onze`;
        }
        // Pour 72-79 et 92-99, on utilise teens[onesPlace] directement car :
        // teens[0] = 'dix', teens[1] = 'onze', teens[2] = 'douze', teens[3] = 'treize', etc.
        // 72 = soixante-douze (teens[2] = 'douze')
        // 73 = soixante-treize (teens[3] = 'treize')
        // 77 = soixante-dix-sept (teens[7] = 'dix-sept')
        // 92 = quatre-vingt-douze (teens[2] = 'douze')
        // 97 = quatre-vingt-dix-sept (teens[7] = 'dix-sept')
        return `${base}-${teens[onesPlace]}`;
      }
      if (onesPlace === 0) {
        return tens[tensPlace] === 'quatre-vingt' ? 'quatre-vingts' : tens[tensPlace];
      }
      if (onesPlace === 1 && tensPlace === 8) {
        return 'quatre-vingt-un';
      }
      return `${tens[tensPlace]}${onesPlace === 1 ? '-et-' : '-'}${ones[onesPlace]}`;
    }
    // 100-999
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    const hundredText = hundreds === 1 ? 'cent' : `${ones[hundreds]} cent`;
    const remainderText = convertLessThanThousand(remainder);
    return remainderText 
      ? `${hundredText} ${remainderText}`
      : `${hundredText}${hundreds > 1 ? 's' : ''}`;
  }
  
  if (num < 1000) {
    return capitalizeFirst(convertLessThanThousand(num));
  }
  
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    const thousandsText = thousands === 1 
      ? 'mille' 
      : `${convertLessThanThousand(thousands)} mille`;
    const remainderText = convertLessThanThousand(remainder);
    return capitalizeFirst(
      remainderText 
        ? `${thousandsText} ${remainderText}`
        : thousandsText
    );
  }
  
  // Pour les millions et plus, on simplifie
  const millions = Math.floor(num / 1000000);
  const remainder = num % 1000000;
  const millionsText = millions === 1 
    ? 'un million' 
    : `${convertLessThanThousand(millions)} millions`;
  const remainderText = remainder > 0 
    ? numberToWords(remainder).toLowerCase()
    : '';
  return capitalizeFirst(
    remainderText 
      ? `${millionsText} ${remainderText}`
      : millionsText
  );
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { numberToWords };
