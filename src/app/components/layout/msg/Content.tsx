import { Grid } from '@mui/material';
import { useTimeSince } from 'hooks/useTimeSince';
import React, { useEffect, useRef, useState } from 'react';
import { normalizeContent } from 'service/helper';
import styled from 'styled-components';
import { AudioPreview } from './AudioPreview';
import { Avatar } from './Avatar';
import { VideoPreview } from './VideoPreview';

export interface ContentProps {
  text: string;
  classNames?: string;
}

export function Content({ text, classNames }: ContentProps) {
  const { modifiedText, imageUrls, videoUrls, audioUrls } =
    normalizeContent(text);
  return (
    <span className={classNames}>
      <Texting modifiedText={modifiedText} />
      <p>
        {imageUrls.length > 0 &&
          imageUrls.map((url, index) => (
            <span key={index}>
              <ImagePlate url={url} />
            </span>
          ))}
      </p>
      <p>
        {videoUrls.length > 0 &&
          videoUrls.map((url, index) => (
            <span key={index}>
              <VideoPreview url={url} />
            </span>
          ))}
      </p>
      <p>
        {audioUrls.length > 0 &&
          audioUrls.map((url, index) => (
            <span key={index}>
              <AudioPreview src={url} />
            </span>
          ))}
      </p>
    </span>
  );
}

export interface ArticleShareContentProps {
  text: string;
  classNames?: string;
  shareUrl: string;
  avatar?: string;
  title: string;
  blogName: string;
}

export function ArticleShareContent({
  text,
  shareUrl,
  avatar,
  title,
  blogName,
  classNames,
}: ArticleShareContentProps) {
  return (
    <span className={classNames}>
      <span className={classNames} style={{ whiteSpace: 'pre-line' as const }}>
        {text}
      </span>
      <div
        style={{
          margin: '10px 0px',
          background: 'rgb(247, 245, 235)',
          padding: '5px',
        }}
        onClick={() => {
          window.open(shareUrl, '_blank');
        }}
      >
        <Grid container>
          <Grid item xs={12} style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              picture={avatar}
              style={{ width: '40px', height: '40px', marginRight: '10px' }}
            />
            <span>
              {title} - {blogName}
            </span>
          </Grid>
        </Grid>
      </div>
    </span>
  );
}

export function ArticleContentNoAvatar({
  text,
  shareUrl,
  title,
  blogName,
  classNames,
}: ArticleShareContentProps) {
  return (
    <span className={classNames}>
      <span className={classNames} style={{ whiteSpace: 'pre-line' as const }}>
        {text}
      </span>
      <div
        style={{
          margin: '10px 0px',
          background: 'rgb(247, 245, 235)',
          padding: '5px',
        }}
        onClick={() => {
          window.open(shareUrl, '_blank');
        }}
      >
        <Grid container>
          <Grid
            item
            xs={12}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ padding: '5px' }}>
              {title} - {blogName}
            </span>
          </Grid>
        </Grid>
      </div>
    </span>
  );
}

const Div = styled.div`
  margin: 10px 0px;
  padding: 5px;
  background: none;
  color: gray;
  cursor: pointer;
  border-radius: 5px;
  :hover {
    background: #f4f5f4;
  }
`;

export function ArticleTrendsItem({
  shareUrl,
  avatar,
  title,
  blogName,
  author,
  createdAt,
}: Omit<ArticleShareContentProps, 'text' | 'classNames'> & {
  author?: string;
  createdAt: number;
}) {
  return (
    <span>
      <Div
        onClick={() => {
          window.open(shareUrl, '_blank');
        }}
      >
        <Grid container>
          <Grid item xs={12}>
            <div
              style={{ fontSize: '14px', fontWeight: '500', color: 'black' }}
            >
              {title}
            </div>
            <div style={{ fontSize: '12px', color: 'gray' }}>
              {/**
               *  
              {author}
              {' on '}
              {blogName}
              {' · '}
              {useTimeSince(createdAt)}
              */}
              {useTimeSince(createdAt)}
            </div>
          </Grid>
        </Grid>
      </Div>
    </span>
  );
}

export function ImagePlate({ url }: { url: string }) {
  // image click effect
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const handleClick = (event: React.MouseEvent) => {
    if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
      setShowPopup(false);
    }
  };

  return (
    <>
      <img
        src={url}
        alt=""
        style={{
          maxWidth: '100%',
          width: `48px`,
          cursor: 'pointer',
        }}
        onClick={() => setShowPopup(true)}
      />
      {showPopup && (
        <div style={{ maxWidth: '800px', maxHeight: '900px' }}>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'gray',
              opacity: 0.6,
              zIndex: '2',
            }}
            onClick={handleClick}
          />
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              border: '1px solid white',
              padding: '2px',
              boxShadow: '0 0 5px white',
              zIndex: '500',
            }}
          >
            <div
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              <img
                src={url}
                style={{ width: '100%', height: '100%', maxHeight: '900px' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const Texting = ({ modifiedText }: { modifiedText: string }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [plainText, setPlainText] = useState('');

  useEffect(() => {
    // Extract all the anchor tags from modifiedText
    const anchorTagRegex = /<a.*?>(.*?)<\/a>/g;
    const anchorTags = modifiedText.match(anchorTagRegex);

    // Remove all the anchor tags from modifiedText and set the rest of the content as plain text
    let plainText = modifiedText;
    if (anchorTags != null) {
      anchorTags.forEach(tag => {
        plainText = plainText.replace(tag, '');
      });
    }

    // Set the anchor tags in the state
    if (anchorTags != null) {
      const html = anchorTags.reduce((acc, tag) => {
        const m = tag.match(/<a.*href="(.*?)".*?>(.*?)<\/a>/);
        if (m != null) {
          const [, link, text] = m;
          return acc + `<a href="${link}" target="_blank">${text}</a>`;
        } else {
          return acc;
        }
      }, '');

      setHtml(html);
    }
    setPlainText(plainText);
  }, [modifiedText]);

  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {plainText}
      {html && <span dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
};
