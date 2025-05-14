# Charpstar Unified - Startup Guide

## Tech Stack

- **Frontend:** Next.js (App Router, React 18)
- **UI:** shadcn/ui, Tailwind CSS, Lucide Icons
- **Auth:** NextAuth.js
- **Backend/DB:** Supabase (Postgres, Auth, Storage)
- **Validation:** Zod, React Hook Form
- **State/UX:** Toast notifications, Dialogs, Dropdowns

## Features

- Authentication (Sign up, Login, Role-based access)
- User management (CRUD, roles, permissions)
- Dashboard, Users, Settings pages
- Admin permissions management (assign page access per role)
- Responsive, modern UI with custom theming

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/charpstar-unified.git
cd charpstar-unified
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root with:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXTAUTH_SECRET=your-nextauth-secret
```

### 4. Set Up Supabase

- Create a Supabase project at https://app.supabase.com
- Run the SQL in `supabase/migrations/` to set up tables:
  - `users`, `profiles`, `role_permissions`, etc.
- Set up authentication providers if needed (email, OAuth, etc.)

### 5. Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the app.

## Usage Notes

- **Admin Permissions:**
  - Only admins see the "Permissions" link in the sidebar.
  - Use `/admin/permissions` to assign which roles can access which pages.
- **Role-based Access:**
  - All main pages check the user's role and permissions before rendering.
  - If a user lacks access, they see a "No Access" message.
- **Theming:**
  - Colors and UI are managed via Tailwind and CSS variables in `globals.css`.
  - Role badges have distinct colors for clarity (not yet good colors).

## Customization

- Add new pages to the `Sidebar` and `role_permissions` table as needed.
- Update roles or permissions via the admin UI or directly in Supabase.
- Adjust theme colors in `app/globals.css`.

## Contributing

Pull requests and issues are welcome!

---

**Charpstar Unified** - Modern, scalable, and beautiful user management with RBAC.
