import mysql from 'mysql';

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234567',
    database: 'shopperdb'
});

export default {
    connection: conn,

    connect: () => {
        conn.connect(
            err => err ? 
                console.log(err) : 
                console.log('Database connected successfully!')
        );
    },

    disconnect: () => {
        conn.end(err => err ? 
            console.log(err) : 
            console.log('Database disconnected successfully!')
        )
    }
}