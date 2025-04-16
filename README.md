A simple web app that manages subscribers using the Campaign Monitor API.

Features:
- The user can add/remove subscribers using the UI.
- The subscribers list is displayed in table format.
- No full page reloading is needed to update the list contents.
- While Syncing, the app is still usable.

Setup and Installation:

    - Install dependencies:
        npm install

    - Run locally (development):
        npm run dev
    
    - Site on:  http://localhost:3000 by default.

    - Create a .env.local file in the root directory and in it include your: CM_API_KEY, CM_CLIENT_ID, CM_LIST_ID and their values.

    
