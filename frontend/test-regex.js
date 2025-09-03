const testFiles = [
  'letterboxd-halcyonage-2025-08-29-14-41-utc.csv',
  'letterboxd-anlaki-2025-08-28-19-42-utc.csv', 
  'letterboxd-tolgay-2025-08-03-07-53-utc.csv'
];

const regex = /^letterboxd-([^-\s]+)-/i;

console.log('Testing regex pattern: /^letterboxd-([^-\\s]+)-/i');
console.log('='.repeat(60));

testFiles.forEach(filename => {
  const match = filename.match(regex);
  console.log(`Filename: ${filename}`);
  console.log(`Result: ${match ? match[1] : 'NO MATCH'}`);
  console.log('-'.repeat(40));
});
