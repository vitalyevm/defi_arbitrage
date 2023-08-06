const path = require('path'); 
const dotenv = require('dotenv');
const fs = require('fs');
// require('dotenv').config({ path: path.join(__dirname,'.env.development') });
const envConfig = dotenv.parse(fs.readFileSync('.env.prod'));
// console.log(envConfig)
module.exports = {
  apps: [
    {
      name: 'bot',
      script: 'ts-node',
      args: 'main.ts mempool', // Replace arg1, arg2, arg3 with your arguments
      interpreter: 'none',
      env: {
          ...envConfig,
          NODE_ENV: 'prod' 
      },
    },
  ],
};
  