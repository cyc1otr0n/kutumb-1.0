# Kutumb

Kutumb is a smart, AI-powered shared memory and scheduling application for families. It acts as a central hub where family members can share events, tasks, reminders, and updates using natural language and voice recordings. 

Powered by Google's Gemma model, Kutumb understands conversational requests—like *"where is tomorrow's dinner planned?"* or *"remind everyone tomorrow morning to take out the trash"*—and automatically updates the family schedule and memory.

## Features

- **🗣️ Voice & Text Interactions**: Use the built-in microphone or text bar to tell Kutumb about upcoming plans, new tasks, or facts to remember.
- **📅 Smart Calendar & Tasks**: Events and tasks are automatically parsed from your messages and organized on a unified timeline.
- **🧠 Family Memory**: Kutumb remembers family preferences, decisions, and notes, acting as a shared knowledge base.
- **⏰ Durable Reminders**: Powered by Temporal, reminders survive server restarts and reliably notify the family.
- **🤖 Powered by AI**: Mastra Agent orchestration combined with Gemma models ensures highly accurate and contextual responses.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **AI / Agent**: [Mastra](https://mastra.ai/), [Gemma Models](https://ai.google.dev/gemma) (via Google Generative AI)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/)
- **Workflows & Reminders**: [Temporal](https://temporal.io/)
- **Observability**: [Sentry](https://sentry.io/)
- **Styling**: Tailwind CSS v4

## Getting Started

### Prerequisites
- Node.js (v20+)
- A MongoDB cluster (Atlas)
- A Gemini API Key
- Temporal Server running locally or Temporal Cloud

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cyc1otr0n/kutumb-1.0.git
   cd kutumb-1.0
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your `MONGODB_URI`, `GOOGLE_GENERATIVE_AI_API_KEY`, and Temporal configurations.

4. **Seed the Database (Optional)**
   ```bash
   npm run seed
   ```

5. **Start the Temporal Worker**
   Run the durable reminder worker in a separate terminal:
   ```bash
   npm run worker
   ```

6. **Start the Development Server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License

Private - All rights reserved.
