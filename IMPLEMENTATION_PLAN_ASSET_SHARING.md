# Implementation Plan: Asset Sharing for External Review

## Overview

Allow clients in the `/client-review` page to select assets and share them with external team members via email invitation. The invitee will receive a public link that allows them to view and approve/reject assets without needing a platform account.

---

## Phase 1: Database Schema

### 1.1 Create `asset_share_invitations` Table

**Location:** Supabase Migration or SQL

```sql
CREATE TABLE asset_share_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  token TEXT NOT NULL UNIQUE, -- Unique token for the share link
  asset_ids UUID[] NOT NULL, -- Array of onboarding_assets.id
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  message TEXT, -- Optional message from the sharer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for token lookups (public access)
CREATE INDEX idx_asset_share_invitations_token ON asset_share_invitations(token);
CREATE INDEX idx_asset_share_invitations_created_by ON asset_share_invitations(created_by);
CREATE INDEX idx_asset_share_invitations_status ON asset_share_invitations(status);

-- Enable RLS
ALTER TABLE asset_share_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can view their own invitations
CREATE POLICY "Users can view their own invitations"
  ON asset_share_invitations FOR SELECT
  USING (auth.uid() = created_by);

-- Policy: Public read access with valid token (for public page)
-- Note: This will be handled via API route with token validation
```

### 1.2 Create `asset_share_responses` Table

**Location:** Supabase Migration or SQL

```sql
CREATE TABLE asset_share_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES asset_share_invitations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES onboarding_assets(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'revision', 'comment')),
  comment TEXT, -- Optional comment/feedback
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invitation_id, asset_id) -- One response per asset per invitation
);

CREATE INDEX idx_asset_share_responses_invitation_id ON asset_share_responses(invitation_id);
CREATE INDEX idx_asset_share_responses_asset_id ON asset_share_responses(asset_id);

ALTER TABLE asset_share_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Public insert with valid token (handled via API)
```

---

## Phase 2: API Endpoints

### 2.1 Create Share Invitation API

**File:** `charpstar-unified/app/api/assets/share-review/route.ts`

**Features:**

- Validate user is authenticated and has client role
- Validate selected assets belong to user's client
- Generate unique token (crypto.randomUUID or similar)
- Set expiration (default 30 days)
- Store invitation in database
- Send invitation email
- Return invitation details

**Request Body:**

```typescript
{
  recipientEmail: string;
  recipientName?: string;
  assetIds: string[];
  message?: string;
  expiresInDays?: number; // Default 30
}
```

**Response:**

```typescript
{
  success: true;
  invitationId: string;
  shareLink: string;
  expiresAt: string;
}
```

### 2.2 Get Shared Assets (Public)

**File:** `charpstar-unified/app/api/shared-reviews/[token]/route.ts`

**Features:**

- Validate token exists and is not expired
- Check invitation status
- Return invitation details and asset data
- Update `viewed_at` on first access
- Update `status` to 'viewed' if still 'pending'

**Response:**

```typescript
{
  invitation: {
    id: string;
    recipientName: string;
    recipientEmail: string;
    message?: string;
    expiresAt: string;
    status: string;
    createdBy: {
      name: string;
      email: string;
    };
  };
  assets: Array<{
    id: string;
    productName: string;
    articleId: string;
    status: string;
    glbLink?: string;
    reference?: string[];
    previewImage?: string;
    productLink?: string;
  }>;
  responses?: Array<{
    assetId: string;
    action: 'approve' | 'revision';
    comment?: string;
  }>;
}
```

### 2.3 Submit Review Response (Public)

**File:** `charpstar-unified/app/api/shared-reviews/[token]/submit/route.ts`

**Features:**

- Validate token and expiration
- Validate invitation status allows responses
- Store responses in `asset_share_responses`
- Update asset statuses in `onboarding_assets` table
- Create activity logs
- Send notification to original sharer
- Update invitation status to 'completed' if all assets responded to

**Request Body:**

```typescript
{
  responses: Array<{
    assetId: string;
    action: "approve" | "revision";
    comment?: string;
  }>;
}
```

**Response:**

```typescript
{
  success: true;
  message: string;
}
```

### 2.4 List User's Shares

**File:** `charpstar-unified/app/api/assets/share-review/list/route.ts`

**Features:**

- Return all shares created by authenticated user
- Include status, recipient info, asset count
- Filtering and pagination support

### 2.5 Cancel/Revoke Share

**File:** `charpstar-unified/app/api/assets/share-review/[id]/cancel/route.ts`

**Features:**

- Validate ownership
- Update status to 'cancelled'
- Prevent further access

---

## Phase 3: Email Service

### 3.1 Create Email Template Component

**File:** `charpstar-unified/components/emails/AssetShareInvitationEmail.tsx`

**Features:**

- React email component
- Include sharer name, asset count, expiration date
- Prominent "Review Assets" button with link
- Professional design matching existing templates

### 3.2 Add Email Method to EmailService

**File:** `charpstar-unified/lib/emailService.ts`

**Method:**

```typescript
async sendAssetShareInvitation(data: AssetShareInvitationData): Promise<EmailResult>
```

**Interface:**

```typescript
export interface AssetShareInvitationData {
  recipientEmail: string;
  recipientName?: string;
  sharerName: string;
  sharerEmail: string;
  assetCount: number;
  shareLink: string;
  expiresAt: string;
  message?: string;
}
```

### 3.3 Create Email API Route (Optional)

**File:** `charpstar-unified/app/api/email/asset-share-invitation/route.ts`

**Features:**

- Use Resend service
- Send invitation email
- Handle errors gracefully

---

## Phase 4: Frontend - Client Review Page

### 4.1 Add "Share for Review" Button

**File:** `charpstar-unified/app/(dashboard)/client-review/page.tsx`

**Location:** In bulk actions section (around line 1100)

**Features:**

- Only visible when assets are selected
- Opens dialog to enter recipient email and optional message
- Calls share API
- Shows success/error toast

**UI Component:**

```tsx
{
  selected.size > 0 && (
    <Button
      size="sm"
      onClick={() => setShowShareDialog(true)}
      className="h-8 px-3 text-xs"
    >
      <Share className="h-3 w-3 mr-1" />
      Share for Review
    </Button>
  );
}
```

### 4.2 Create Share Dialog Component

**File:** `charpstar-unified/components/ui/containers/ShareForReviewDialog.tsx`

**Features:**

- Email input (required)
- Name input (optional)
- Message textarea (optional)
- Asset count display
- Expiration info
- Submit button
- Loading state
- Error handling

### 4.3 Add Share Management Section (Optional)

**File:** `charpstar-unified/app/(dashboard)/client-review/page.tsx`

**Features:**

- Tab or section to view sent shares
- Status indicators (pending, viewed, completed)
- Ability to cancel/revoke
- Copy link button
- Resend email option

---

## Phase 5: Public Review Page

### 5.1 Create Public Route Layout

**File:** `charpstar-unified/app/shared-review/[token]/layout.tsx`

**Features:**

- No authentication required
- No sidebar/header (or minimal header)
- Token validation
- Redirect to expired page if invalid/expired

### 5.2 Create Public Review Page

**File:** `charpstar-unified/app/shared-review/[token]/page.tsx`

**Features:**

- Fetch shared assets via API
- Display invitation info (recipient name, sharer name, message)
- Asset list/grid view
- For each asset:
  - Product name, article ID
  - Preview image or 3D viewer
  - GLB link (if available)
  - Reference images
  - Product link
  - Action buttons: "Approve" or "Send for Revision"
  - Comment/feedback textarea
- Bulk actions (approve all, revision all)
- Submit button
- Success confirmation
- Mobile responsive

**UI Layout:**

- Header with invitation info
- Asset cards in grid/list
- Action panel (sticky on scroll)
- Submission confirmation modal

### 5.3 Create Asset Viewer Component

**File:** `charpstar-unified/components/shared-review/SharedAssetCard.tsx`

**Features:**

- Display asset info
- Image preview
- 3D viewer integration (if available)
- Action buttons
- Comment input
- Status indicators

### 5.4 Handle Expired/Invalid Links

**File:** `charpstar-unified/app/shared-review/[token]/error.tsx`

**Features:**

- Expired link message
- Invalid link message
- Contact information

---

## Phase 6: Security & Validation

### 6.1 Token Generation

**Implementation:**

- Use `crypto.randomUUID()` or similar
- Ensure uniqueness (database constraint)
- Long enough to prevent guessing (UUID v4 is sufficient)

### 6.2 Expiration Handling

**Implementation:**

- Default 30 days
- Configurable per invitation
- Automatic status update to 'expired'
- Clear messaging on expired links

### 6.3 Rate Limiting

**Implementation:**

- Limit invitations per user per day
- Limit API calls per token
- Prevent abuse

### 6.4 Input Validation

**Implementation:**

- Email format validation
- Asset ID validation
- Sanitize user inputs
- Prevent XSS attacks

### 6.5 Access Control

**Implementation:**

- Token-based access only
- No authentication required for public page
- Verify token on every request
- Log access attempts

---

## Phase 7: Activity Logging & Notifications

### 7.1 Log Share Creation

**File:** Activity logging system

**Events to Log:**

- Share invitation created
- Share link accessed
- Asset approved/revision requested
- Share completed

### 7.2 Notifications

**Implementation:**

- Notify original sharer when:
  - Invitation is viewed
  - Assets are approved/rejected
  - Share is completed
- Use existing notification system

---

## Phase 8: Testing Checklist

### 8.1 Unit Tests

- [ ] Token generation uniqueness
- [ ] Expiration logic
- [ ] Email template rendering
- [ ] API validation

### 8.2 Integration Tests

- [ ] Share creation flow
- [ ] Email sending
- [ ] Public page access
- [ ] Response submission
- [ ] Status updates

### 8.3 E2E Tests

- [ ] Complete workflow from client selection to external review
- [ ] Multiple assets
- [ ] Expired link handling
- [ ] Error scenarios

### 8.4 Security Tests

- [ ] Token uniqueness
- [ ] Expired link access denied
- [ ] Invalid token handling
- [ ] XSS prevention
- [ ] Rate limiting

---

## Phase 9: Documentation

### 9.1 User Documentation

- How to share assets for review
- How to review shared assets (external users)
- FAQ section

### 9.2 Developer Documentation

- API endpoint documentation
- Database schema documentation
- Security considerations

---

## Implementation Order

1. **Phase 1** - Database schema (foundation)
2. **Phase 2.1** - Create share API (core functionality)
3. **Phase 3** - Email service (enables sharing)
4. **Phase 4** - Client UI (user can share)
5. **Phase 2.2-2.5** - Remaining APIs (public access)
6. **Phase 5** - Public review page (external user can review)
7. **Phase 6** - Security hardening
8. **Phase 7** - Logging and notifications
9. **Phase 8** - Testing
10. **Phase 9** - Documentation

---

## Estimated Timeline

- **Phase 1:** 1-2 hours
- **Phase 2:** 4-6 hours
- **Phase 3:** 2-3 hours
- **Phase 4:** 3-4 hours
- **Phase 5:** 6-8 hours
- **Phase 6:** 2-3 hours
- **Phase 7:** 2-3 hours
- **Phase 8:** 4-6 hours
- **Phase 9:** 2-3 hours

**Total:** ~26-38 hours

---

## Technical Considerations

### Email Service

- Use existing Resend integration
- Follow existing email template patterns
- Handle email failures gracefully

### Public Route Security

- No authentication middleware on public route
- Token validation in API routes
- Server-side token verification

### Asset Access

- Only share assets from `onboarding_assets` table
- Respect asset permissions
- Don't expose sensitive data

### Status Updates

- When external user approves: Update asset status to `approved_by_client`
- When external user requests revision: Update asset status to `client_revision`
- Create activity log entries
- Trigger notifications

### Edge Cases

- Multiple shares for same asset
- Share cancellation mid-review
- Expired link while reviewing
- Network failures
- Email delivery failures

---

## Future Enhancements (Post-MVP)

1. **Batch Sharing** - Share multiple sets of assets in one invitation
2. **Review History** - Track all review iterations
3. **Comments/Annotations** - Allow external users to add annotations
4. **Download Assets** - Allow external users to download GLB files
5. **Custom Expiration** - Per-invitation expiration settings
6. **Share Analytics** - Track view counts, time spent
7. **Multi-recipient** - Share with multiple people at once
8. **Review Templates** - Pre-filled review forms
