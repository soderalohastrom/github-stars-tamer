# GEMINI.md

## Project Overview

This is a React Native mobile application built with Expo for organizing GitHub starred repositories. The application allows users to categorize their starred repositories, search and filter them, and sync them with their GitHub account.

The project uses a modern stack:

*   **Frontend:** React Native with Expo, TypeScript, and Expo Router for navigation.
*   **Backend:** Convex for the real-time database and backend logic.
*   **Authentication:** Clerk is used for user authentication with GitHub OAuth.
*   **State Management:** Zustand is used for lightweight state management.

The application features a clean, modern UI with support for both light and dark themes. It also includes advanced features like drag-and-drop for reorganizing repositories, haptic feedback, and a statistics dashboard. A key feature is the AI-powered categorization suggestion, which helps users organize their repositories more efficiently.

## Building and Running

### Prerequisites

*   Node.js 18+
*   Expo CLI (`npm install -g @expo/cli`)
*   An iOS Simulator or Android Emulator
*   A Convex account and project
*   A Clerk account and application

### Setup

1.  **Clone the repository and install dependencies:**

    ```bash
    git clone <repository-url>
    cd minimax-stars-organizer
    npm install
    ```

2.  **Set up environment variables:**

    Create a `.env` file by copying `.env.example` and fill in your Convex and Clerk credentials:

    ```env
    EXPO_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
    ```

3.  **Set up Convex:**

    ```bash
    npx convex dev
    ```

### Running the Application

1.  **Start the Expo development server:**

    ```bash
    npm start
    ```

2.  **Run on a simulator:**

    *   For iOS: `npm run ios`
    *   For Android: `npm run android`

3.  **Run the Convex development server:**

    In a separate terminal, run:

    ```bash
    npm run convex:dev
    ```

## Development Conventions

*   **File-based Routing:** The application uses Expo Router, which means that the file system in the `app/` directory determines the routes.
*   **Component-based Architecture:** Reusable UI components are located in the `src/components/` directory.
*   **Backend Logic in Convex:** All backend logic, including the database schema, is located in the `convex/` directory.
*   **TypeScript:** The project is written in TypeScript, and type safety is enforced.
*   **State Management:** Zustand is used for global state management, but component-level state is managed with React Hooks.
*   **Styling:** Styles are defined using React Native's `StyleSheet` API.
*   **Testing:** TODO: Add information about the testing strategy.
