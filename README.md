# SHIMPI — Custom Tailored Clothing Platform

A complete Node.js + Express + EJS + Firebase Firestore starter for a premium custom tailoring brand that combines tradition and modern fashion.

## Features
- Customer registration and login
- Product catalog with custom tailoring workflow
- Measurement profiles
- Order placement and tracking
- Appointment booking for home visits or virtual consultations
- Admin dashboard for products, orders, customers, and bootstrap seeding
- Firestore schema bootstrap and sample product seeding

## Tech Stack
- Node.js
- Express
- EJS
- Firebase Admin SDK
- Firestore
- Bootstrap 5 via CDN

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and fill in your Firebase service account values.

3. Seed the database:
   ```bash
   npm run seed
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Firebase Setup
Create a Firebase project, enable Firestore, and generate a service account key from Firebase Console / Google Cloud Console.

This app uses Firestore collections:
- `users`
- `measurements`
- `products`
- `orders`
- `appointments`
- `site_config`

The bootstrap script also creates:
- `site_config/bootstrap`
- `site_config/schema`

## Default Admin
The seed script can create an admin user using:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Notes
This is a full working starter. For production, you should:
- move authentication to Firebase Auth
- add CSRF protection
- add image upload storage to Firebase Storage
- add payment gateway integration
- add email/SMS notifications
