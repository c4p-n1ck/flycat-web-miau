import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PrivateKey,
  PublicKey,
  RawEvent,
  Event,
  WellKnownEventKind,
} from 'service/api';
import { FlagType, Flycat, ShareContentId } from 'service/flycat-protocol';

export interface ShareArticleProps {
  isOpen: boolean;
  onClose: () => void;

  pk: PublicKey;
  id: ShareContentId;
  title?: string;
  url: string;
  blogName: string;
  blogAvatar?: string;

  suffix?: string;

  loginUser?: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
  };
  onSubmit?: (event: Event) => any;
}

export const ShareArticle = ({
  isOpen,
  onClose,
  pk,
  id,
  title,
  url,
  blogName,
  blogAvatar,
  suffix,
  loginUser,
  onSubmit,
}: ShareArticleProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState<string>('');

  const genShareEvent = async () => {
    const opt = {
      publicKey: loginUser!.publicKey,
      privateKey: loginUser!.privateKey,
      version: '',
    };
    const flycat = new Flycat(opt);
    const shareContentId = flycat.newShareContentId(FlagType.ArticlePage, id);
    const header = flycat.newShareHeader(pk, shareContentId);
    const cacheHeader = flycat.newShareArticleCacheHeader(
      title ?? '',
      url,
      blogName,
      blogAvatar ?? '',
    );
    const content = text + suffix ?? '';
    const rawEvent = new RawEvent(
      loginUser!.publicKey,
      WellKnownEventKind.text_note,
      [header, cacheHeader],
      content,
    );
    const event = rawEvent.toEvent(loginUser!.privateKey);
    return event;
  };

  const submitText = async () => {
    console.log('Text:', text);

    const event = await genShareEvent();
    if (onSubmit) {
      onSubmit(event);
    }
    onClose();
  };

  return (
    <>
      <div>
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '20px',
              zIndex: 999,
              width: '400px',
              height: 'auto',
              boxShadow: '0px 0px 10px #ccc',
              borderRadius: '5px',
            }}
          >
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              style={{ width: '100%', height: '150px', padding: '5px' }}
            ></textarea>
            <button onClick={submitText} disabled={!loginUser}>
              {t('share.rePostShare')}
            </button>
            &nbsp;&nbsp;&nbsp;
            <button onClick={onClose}>{t('share.cancel')}</button>
          </div>
        )}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 998,
            background: 'black',
            opacity: 0.5,
            filter: 'blur(5px)',
            display: isOpen ? 'block' : 'none',
          }}
        ></div>
      </div>
    </>
  );
};
