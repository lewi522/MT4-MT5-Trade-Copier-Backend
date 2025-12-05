const client = require("./db/db.js")
const bcrypt = require("bcryptjs")

const emailExists = async (email) => {
    const data = await client.query("SELECT * FROM users WHERE email=$1", [
        email,
    ]);
    if (data.rowCount === 0)return false;  
    return data.rows[0];
};

const search_by_id = async (id) => {
    const data = await client.query("SELECT * FROM users WHERE id = $1", [id]);
    
    if(data.rowCount === 0) return false;
    return data.rows[0];
}

const firstUser = async () => {
    const data = await client.query("SELECT * FROM users");
    if(data.rowCount === 0) return true;
    return false;
}

const matchPassword = async (password, hashPassword) => {
    const match = await bcrypt.compare(password, hashPassword);
    return match;
};

module.exports = { emailExists, search_by_id, firstUser, matchPassword };