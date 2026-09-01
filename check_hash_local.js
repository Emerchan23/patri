
const bcrypt = require('bcryptjs');

// Hash from the SQL script
const hash = '$2a$12$yudRm1XiaYfgxlMopum6f.Te6p5XKKobpHAfjHS2jrnncA8AII7W2';
const pass = 'admin';

bcrypt.compare(pass, hash).then(isValid => {
    console.log(`Checking hash for 'admin': ${isValid}`);
    
    if (!isValid) {
        console.log('Generating new valid hash...');
        bcrypt.hash(pass, 12).then(newHash => {
            console.log('NEW HASH:', newHash);
        });
    } else {
        console.log('Hash is VALID. The problem is not the hash.');
    }
});
