import { LegalPageView } from '@/components/ui/legal-page';
import {
  LEGAL_DRAFT,
  LEGAL_DRAFT_NOTICE,
  LEGAL_UPDATED,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
} from '@/constants/legal';

/** Privacy Policy. Content lives in constants/legal.ts. */
export default function PrivacyScreen() {
  return (
    <LegalPageView
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
      draftNotice={LEGAL_DRAFT ? LEGAL_DRAFT_NOTICE : undefined}
    />
  );
}
