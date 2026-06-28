const bcrypt = require("bcrypt");

const password = "Strawberry@2005"; // ← CHANGE THIS TO YOUR DESIRED PASSWORD

bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log("✅ Generated bcrypt hash:");
  console.log(hash);
  console.log("\nUse this hash in your UPDATE query");
});
