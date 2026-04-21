import { useTranslation } from 'react-i18next';

/**
 * Fixed footer displayed at the bottom-right of the screen.
 *
 * Shows the developer's name, a link to the project page on their personal
 * site, and a Ko-fi donation button.
 *
 * Ko-fi was chosen over Buy Me a Coffee because:
 *  - No commission on one-time donations (Buy Me a Coffee charges 5%)
 *  - Free tier covers all features needed here
 *  - Widely used in open-source / indie developer communities
 *
 * To configure:
 *  - Replace KOFI_USERNAME with your Ko-fi username
 *  - Replace PERSONAL_SITE_URL with the URL of the project page on your site
 *  - Replace DEVELOPER_NAME with your name or handle
 */

const KOFI_USERNAME = 'pending_to_be_created';   // ← replace
const PERSONAL_SITE_URL = 'https://diegocastroviadero.com/projects/solar-simulator';
const DEVELOPER_NAME = 'Diego Castro';

export function DeveloperFooter() {
    const { t } = useTranslation();

    return (
        <div className="developer-footer">
            <span className="developer-footer__made-by">
                {t('footer.madeBy')}{' '}
                <a
                    href={PERSONAL_SITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="developer-footer__site-link"
                >
                    {DEVELOPER_NAME}
                </a>
            </span>

            <span className="developer-footer__separator">·</span>

            <a
                href={`https://ko-fi.com/${KOFI_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="developer-footer__kofi-link"
                title={t('footer.donateTitle')}
            >
                ☕ {t('footer.donate')}
            </a>
        </div>
    );
}