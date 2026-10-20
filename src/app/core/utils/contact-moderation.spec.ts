import { findContactSharing } from './contact-moderation';

/**
 * The composer pre-check must catch the same contact-sharing patterns as the server so the
 * user gets an immediate translated warning. The server still re-checks every message.
 */

describe('findContactSharing', () => {
  it('detects the reported disguised Facebook account reference', () => {
    expect(findContactSharing('Hada Hsabi Facebook Bilal Karbach')).toContain('FACEBOOK');
    expect(findContactSharing('Hada Hsabi Facebook Bilal')).toContain('FACEBOOK');
  });

  it('detects lowercase, uncued, French and Arabic account references', () => {
    expect(findContactSharing('facebook bilal karbach')).toContain('FACEBOOK');
    expect(findContactSharing('my facebook is bilal karbach')).toContain('FACEBOOK');
    expect(findContactSharing('facebook account bilal')).toContain('FACEBOOK');
    expect(findContactSharing('hada hsabi facbook bilal karbach')).toContain('FACEBOOK');
    expect(findContactSharing("mon compte facebook c'est Bilal Karbach")).toContain('FACEBOOK');
    expect(findContactSharing('حسابي على فيسبوك بلال كرباش')).toContain('FACEBOOK');
    expect(findContactSharing('فيسبوك بلال كرباش')).toContain('FACEBOOK');
  });

  it('detects links, handles, emails and phone numbers', () => {
    expect(findContactSharing('facebook.com/bilal.karbach')).toContain('FACEBOOK');
    expect(findContactSharing('fb.me/bilalkarbach')).toContain('FACEBOOK');
    expect(findContactSharing('fb.watch/abc123')).toContain('FACEBOOK');
    expect(findContactSharing('instagram.com/bilal')).toContain('INSTAGRAM');
    expect(findContactSharing('wa.me/491761234567')).toContain('WHATSAPP');
    expect(findContactSharing('t.me/bilal')).toContain('TELEGRAM');
    expect(findContactSharing('telegram: @bilalkarbach')).toContain('SOCIAL_HANDLE');
    expect(findContactSharing('mail bilal [at] gmail [dot] com')).toContain('EMAIL');
    expect(findContactSharing('Call me on +49 176 1234567')).toContain('PHONE');
  });

  it('detects spaced, letter-spaced and obfuscated bypasses', () => {
    expect(findContactSharing('face book bilal karbach')).toContain('FACEBOOK');
    expect(findContactSharing('f a c e b o o k Bilal Karbach')).toContain('FACEBOOK');
    expect(findContactSharing('faysbook bilal karbach')).toContain('FACEBOOK');
    expect(findContactSharing('facebook[.]com/bilal')).toContain('FACEBOOK');
  });

  it('does not flag ordinary coaching or legitimate social-media discussion', () => {
    const ordinary = [
      'Let us meet at 10:00 on 2026-10-19 for a 60 minute session.',
      'The session costs €45 and covers 5 km at 70% effort.',
      'Do 3 sets of 12 reps at 60 kg, then rest for 90 seconds.',
      'Facebook is useful for following the local sports club.',
      'We discussed Instagram marketing during the coaching course.',
      'Our Facebook page has the schedule.',
      'Facebook Messenger is down today.',
      'Instagram and TikTok are popular with athletes.',
      'My Facebook account is useful for the club.',
      'Facebook est utile pour le club.',
      'Nous avons parlé de Facebook pendant la formation.',
      'تحدثنا عن فيسبوك خلال التدريب.',
      'فيسبوك موقع جيد للتواصل مع النادي.',
      'WhatsApp group for the team?',
      'Instagram reels are fun.',
    ];

    for (const message of ordinary) {
      expect(findContactSharing(message), message).toEqual([]);
    }
  });
});
