type CookieBannerProps = {
  onAccept: () => void;
  onReject: () => void;
};

const CookieBanner = ({ onAccept, onReject }: CookieBannerProps): JSX.Element => (
  <div className="cookie-banner" data-testid="cookie-banner" role="dialog" aria-label="Cookie consent">
    <div className="cookie-banner__content">
      <p className="cookie-banner__text">
        This site uses <strong>local storage</strong> to remember your theme preference.
        No personal data is collected or shared with third parties.
      </p>
      <div className="cookie-banner__actions">
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--accept"
          data-testid="btn-cookie-accept"
          onClick={onAccept}
        >
          Accept all
        </button>
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--reject"
          data-testid="btn-cookie-reject"
          onClick={onReject}
        >
          Necessary only
        </button>
      </div>
    </div>
  </div>
);

export default CookieBanner;
