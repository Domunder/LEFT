import { LegalPageView } from '@/components/ui/legal-page';
import {
  LEGAL_DRAFT,
  LEGAL_DRAFT_NOTICE,
  LEGAL_UPDATED,
  TERMS_INTRO,
  TERMS_SECTIONS,
} from '@/constants/legal';

/** Terms of Service. Content lives in constants/legal.ts. */
export default function TermsScreen() {
  return (
    <LegalPageView
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
      draftNotice={LEGAL_DRAFT ? LEGAL_DRAFT_NOTICE : undefined}
    />
  );
}
