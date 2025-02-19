import React, { useState, useEffect } from 'react';
import {
  Event,
  EventSubResponse,
  EventSetMetadataContent,
  isEventSubResponse,
  WellKnownEventKind,
  PublicKey,
  PrivateKey,
  RelayUrl,
  PetName,
  EventTags,
  EventContactListPTag,
  isEventPTag,
  RawEvent,
  Filter,
  deserializeMetadata,
} from 'service/api';
import { connect } from 'react-redux';
import RelayManager, {
  WsConnectStatus,
} from '../../components/layout/relay/RelayManager';
import { useParams } from 'react-router-dom';
import NavHeader from 'app/components/layout/NavHeader';
import { FromWorkerMessageData } from 'service/worker/type';
import { equalMaps, getPkFromFlycatShareHeader } from 'service/helper';
import { UserMap } from 'service/type';
import { CallWorker } from 'service/worker/callWorker';
import { UserHeader, UserProfileBox } from 'app/components/layout/UserBox';
import { ProfileShareMsg, ShareMsg } from 'app/components/layout/msg/ShareMsg';
import { ProfileTextMsg } from 'app/components/layout/msg/TextMsg';
import { t } from 'i18next';
import {
  isFlycatShareHeader,
  CacheIdentifier,
  SiteMetaDataContentSchema,
  Flycat,
  ArticleDataSchema,
  validateArticlePageKind,
  ArticlePageContentSchema,
  FlycatWellKnownEventKind,
} from 'service/flycat-protocol';
import { useTranslation } from 'react-i18next';
import { BaseLayout, Left, Right } from 'app/components/layout/BaseLayout';

// don't move to useState inside components
// it will trigger more times unnecessary
let myContactEvent: Event;
let userContactEvent: Event;

const mapStateToProps = state => {
  return {
    isLoggedIn: state.loginReducer.isLoggedIn,
    myPublicKey: state.loginReducer.publicKey,
    myPrivateKey: state.loginReducer.privateKey,
  };
};

export const styles = {
  root: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  title: {
    color: 'black',
    fontSize: '2em',
    fontWeight: '380',
    diplay: 'block',
    width: '100%',
    margin: '5px',
  },
  ul: {
    padding: '10px',
    background: 'white',
    borderRadius: '5px',
  },
  li: {
    display: 'inline',
    padding: '10px',
  },
  content: {
    margin: '5px 0px',
    minHeight: '700px',
    background: 'white',
    borderRadius: '5px',
  },
  left: {
    height: '100%',
    minHeight: '700px',
    padding: '20px',
  },
  right: {
    minHeight: '700px',
    backgroundColor: '#E1D7C6',
    padding: '20px',
  },
  postBox: {},
  postHintText: {
    color: '#acdae5',
    marginBottom: '5px',
  },
  postTextArea: {
    resize: 'none' as const,
    boxShadow: 'inset 0 0 1px #aaa',
    border: '1px solid #b9bcbe',
    width: '100%',
    height: '80px',
    fontSize: '14px',
    padding: '5px',
    overflow: 'auto',
  },
  btn: {
    display: 'box',
    textAlign: 'right' as const,
  },
  message: {
    marginTop: '5px',
  },
  msgsUl: {
    padding: '5px',
  },
  msgItem: {
    display: 'block',
    borderBottom: '1px dashed #ddd',
    padding: '15px 0',
  },
  avatar: {
    display: 'block',
    width: '60px',
    height: '60px',
  },
  msgWord: {
    fontSize: '14px',
    display: 'block',
  },
  userName: {
    textDecoration: 'underline',
    marginRight: '5px',
  },
  time: {
    color: 'gray',
    fontSize: '12px',
    marginTop: '5px',
  },
  smallBtn: {
    fontSize: '12px',
    marginLeft: '5px',
    border: 'none' as const,
  },
  connected: {
    fontSize: '18px',
    fontWeight: '500',
    color: 'green',
  },
  disconnected: {
    fontSize: '18px',
    fontWeight: '500',
    color: 'red',
  },
  userProfile: {
    //padding: '10px',
  },
  userProfileAvatar: {
    width: '80px',
    height: '80px',
    marginRight: '10px',
  },
  userProfileName: {
    fontSize: '20px',
    fontWeight: '500',
  },
  userProfileBtnGroup: {
    marginTop: '20px',
  },
};

export type ContactList = Map<
  PublicKey,
  {
    relayer: RelayUrl;
    name: PetName;
  }
>;
export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

interface UserParams {
  publicKey: string;
}

export const ProfilePage = ({ isLoggedIn, myPublicKey, myPrivateKey }) => {
  const { t } = useTranslation();
  const { publicKey } = useParams<UserParams>();
  const [wsConnectStatus, setWsConnectStatus] = useState<WsConnectStatus>(
    new Map(),
  );

  const [msgList, setMsgList] = useState<Event[]>([]);
  const [userMap, setUserMap] = useState<UserMap>(new Map());
  const [myContactList, setMyContactList] = useState<ContactList>(new Map());
  const [userContactList, setUserContactList] = useState<ContactList>(
    new Map(),
  );
  const [siteMetaData, setSiteMetaData] = useState<
    SiteMetaDataContentSchema & { created_at: number }
  >();
  const [articles, setArticles] = useState<
    (ArticleDataSchema & { page_id: number; pageCreatedAt: number })[]
  >([]);
  const [myKeyPair, setMyKeyPair] = useState<KeyPair>({
    publicKey: myPublicKey,
    privateKey: myPrivateKey,
  });
  const [worker, setWorker] = useState<CallWorker>();

  function _wsConnectStatus() {
    return wsConnectStatus;
  }

  useEffect(() => {
    const worker = new CallWorker(
      (message: FromWorkerMessageData) => {
        if (message.wsConnectStatus) {
          if (equalMaps(_wsConnectStatus(), message.wsConnectStatus)) {
            // no changed
            console.debug('[wsConnectStatus] same, not updating');
            return;
          }

          const data = Array.from(message.wsConnectStatus.entries());
          setWsConnectStatus(prev => {
            const newMap = new Map(prev);
            for (const d of data) {
              const relayUrl = d[0];
              const isConnected = d[1];
              if (
                newMap.get(relayUrl) &&
                newMap.get(relayUrl) === isConnected
              ) {
                continue; // no changed
              }

              newMap.set(relayUrl, isConnected);
            }

            return newMap;
          });
        }
      },
      (message: FromWorkerMessageData) => {
        onMsgHandler.bind(worker)(message.nostrData);
      },
    );
    worker.pullWsConnectStatus();
    setWorker(worker);
  }, []);

  function onMsgHandler(this, res: any) {
    const msg = JSON.parse(res);
    if (isEventSubResponse(msg)) {
      const event = (msg as EventSubResponse)[2];
      switch (event.kind) {
        case WellKnownEventKind.set_metadata:
          const metadata: EventSetMetadataContent = deserializeMetadata(
            event.content,
          );
          setUserMap(prev => {
            const newMap = new Map(prev);
            const oldData = newMap.get(event.pubkey);
            if (oldData && oldData.created_at > event.created_at) {
              // the new data is outdated
              return newMap;
            }

            newMap.set(event.pubkey, {
              ...metadata,
              ...{ created_at: event.created_at },
            });
            return newMap;
          });
          break;

        case WellKnownEventKind.text_note:
          if (event.pubkey === publicKey) {
            setMsgList(oldArray => {
              if (!oldArray.map(e => e.id).includes(event.id)) {
                // do not add duplicated msg
                const newItems = [...oldArray, event];
                // sort by timestamp
                const sortedItems = newItems.sort((a, b) =>
                  a.created_at >= b.created_at ? -1 : 1,
                );
                return sortedItems;
              }
              return oldArray;
            });

            // check if need to sub new user metadata
            const newPks: string[] = [];
            for (const t of event.tags) {
              if (isEventPTag(t)) {
                const pk = t[1];
                if (userMap.get(pk) == null) {
                  newPks.push(pk);
                }
              }
            }
            if (newPks.length > 0) {
              this.subMetadata(newPks);
            }
          }
          break;

        case WellKnownEventKind.contact_list:
          if (event.pubkey === myKeyPair.publicKey) {
            if (
              myContactEvent == null ||
              myContactEvent?.created_at! < event.created_at
            ) {
              myContactEvent = event;
            }
          }

          if (event.pubkey === publicKey) {
            if (
              userContactEvent == null ||
              userContactEvent?.created_at! < event.created_at
            ) {
              userContactEvent = event;
            }
          }
          break;

        case WellKnownEventKind.flycat_site_metadata:
          if (
            siteMetaData != null &&
            siteMetaData.created_at >= event.created_at
          ) {
            // outdated data
            return;
          }

          try {
            const site = Flycat.deserialize(
              event.content,
            ) as SiteMetaDataContentSchema;
            const data = { ...site, ...{ created_at: event.created_at } };
            setSiteMetaData(data);
          } catch (error: any) {
            console.log('Flycat.deserialize failed', error.message);
          }
          break;

        default:
          try {
            if (validateArticlePageKind(event.kind)) {
              const ap = Flycat.deserialize(
                event.content,
              ) as ArticlePageContentSchema;
              if (ap.article_ids.length !== ap.data.length) {
                throw new Error('unexpected data');
              }

              // set new articles
              setArticles(oldArray => {
                let updatedArray = [...oldArray];

                // check if there is old article updated
                for (const newItem of ap.data) {
                  let index = updatedArray.findIndex(
                    item => item.id === newItem.id,
                  );
                  if (index !== -1) {
                    if (newItem.updated_at > updatedArray[index].updated_at) {
                      updatedArray[index] = {
                        ...newItem,
                        ...{
                          page_id: updatedArray[index].page_id,
                          pageCreatedAt: event.created_at,
                        },
                      };
                    }
                  }
                }

                // check if there is new article added
                const newData: (ArticleDataSchema & {
                  page_id: number;
                  pageCreatedAt: number;
                })[] = [];
                for (const a of ap.data) {
                  if (!updatedArray.map(o => o.id).includes(a.id)) {
                    newData.push({
                      ...a,
                      ...{
                        page_id: ap.page_id,
                        pageCreatedAt: event.created_at,
                      },
                    });
                  }
                }

                // sort by timestamp
                const unsorted = [...updatedArray, ...newData];
                const sorted = unsorted.sort((a, b) =>
                  a.created_at >= b.created_at ? -1 : 1,
                );
                return sorted;
              });
            }
          } catch (error) {}
          break;
      }
    }
  }

  useEffect(() => {
    if (isLoggedIn !== true) return;

    setMyKeyPair({
      publicKey: myPublicKey,
      privateKey: myPrivateKey,
    });
  }, [isLoggedIn]);

  useEffect(() => {
    if (myContactEvent == null) return;

    const contacts = myContactEvent.tags.filter(
      t => t[0] === EventTags.P,
    ) as EventContactListPTag[];

    let cList: ContactList = new Map(myContactList);

    contacts.forEach(c => {
      const pk = c[1];
      const relayer = c[2];
      const name = c[3];
      if (!cList.has(pk)) {
        cList.set(pk, {
          relayer,
          name,
        });
      }
    });

    setMyContactList(cList);
  }, [myContactEvent]);

  useEffect(() => {
    if (userContactEvent == null) return;

    const contacts = userContactEvent.tags.filter(
      t => t[0] === EventTags.P,
    ) as EventContactListPTag[];

    let cList: ContactList = new Map(userContactList);

    contacts.forEach(c => {
      const pk = c[1];
      const relayer = c[2];
      const name = c[3];
      if (!cList.has(pk)) {
        cList.set(pk, {
          relayer,
          name,
        });
      }
    });

    setUserContactList(cList);
  }, [userContactEvent]);

  useEffect(() => {
    // todo: validate publicKey
    if (publicKey.length === 0) return;

    const pks = [publicKey];
    if (isLoggedIn && myPublicKey.length > 0) {
      pks.push(myPublicKey);
    }

    worker?.subContactList(pks);
    worker?.subMetadata(pks);
    worker?.subMsg([publicKey]);
    worker?.subBlogSiteMetadata([publicKey]);
  }, [wsConnectStatus]);

  useEffect(() => {
    if (siteMetaData == null) return;

    const pageIds = siteMetaData.page_ids.map(
      p => p + FlycatWellKnownEventKind.SiteMetaData,
    );
    if (pageIds.length === 0) return;

    const filter: Filter = {
      authors: [publicKey],
      kinds: pageIds,
    };
    worker?.subFilter(filter);
  }, [siteMetaData]);

  const followUser = async () => {
    const contacts = Array.from(myContactList.entries());
    const tags = contacts.map(
      c =>
        [
          EventTags.P,
          c[0],
          c[1].relayer ?? '',
          c[1].name ?? '',
        ] as EventContactListPTag,
    );
    tags.push([EventTags.P, publicKey, '', '']);
    if (tags.length != contacts.length + 1) {
      return alert('something went wrong with contact list');
    }

    const rawEvent = new RawEvent(
      myKeyPair.publicKey,
      WellKnownEventKind.contact_list,
      tags,
    );
    const event = await rawEvent.toEvent(myKeyPair.privateKey);
    worker?.pubEvent(event);

    alert('done, refresh page please!');
  };
  const unfollowUser = async () => {
    const contacts = Array.from(myContactList.entries());
    const tags = contacts
      .filter(c => c[0] !== publicKey)
      .map(
        c =>
          [
            EventTags.P,
            c[0],
            c[1].relayer ?? '',
            c[1].name ?? '',
          ] as EventContactListPTag,
      );
    if (tags.length != contacts.length - 1) {
      return alert('something went wrong with contact list');
    }

    const rawEvent = new RawEvent(
      myKeyPair.publicKey,
      WellKnownEventKind.contact_list,
      tags,
    );
    const event = await rawEvent.toEvent(myKeyPair.privateKey);
    worker?.pubEvent(event);

    alert('done, refresh page please!');
  };
  const followOrUnfollowOnClick =
    isLoggedIn && myContactList.get(publicKey) ? unfollowUser : followUser;

  return (
    <BaseLayout>
      <Left>
        <div style={styles.userProfile}>
          <UserHeader
            pk={publicKey}
            followOrUnfollow={!(isLoggedIn && myContactList.get(publicKey))}
            followOrUnfollowOnClick={followOrUnfollowOnClick}
            avatar={userMap.get(publicKey)?.picture}
            name={userMap.get(publicKey)?.name}
            blogName={siteMetaData?.site_name}
            articleCount={articles.length}
          />
        </div>

        <div style={styles.message}>
          <ul style={styles.msgsUl}>
            {msgList.map((msg, index) => {
              //@ts-ignore
              const flycatShareHeaders: FlycatShareHeader[] = msg.tags.filter(
                t => isFlycatShareHeader(t),
              );
              if (flycatShareHeaders.length > 0) {
                const blogPk = getPkFromFlycatShareHeader(
                  flycatShareHeaders[flycatShareHeaders.length - 1],
                );
                const cacheHeaders = msg.tags.filter(
                  t => t[0] === CacheIdentifier,
                );
                let articleCache = {
                  title: t('thread.noArticleShareTitle'),
                  url: '',
                  blogName: t('thread.noBlogShareName'),
                  blogPicture: '',
                };
                if (cacheHeaders.length > 0) {
                  const cache = cacheHeaders[cacheHeaders.length - 1];
                  articleCache = {
                    title: cache[1],
                    url: cache[2],
                    blogName: cache[3],
                    blogPicture: cache[4],
                  };
                }
                return (
                  <ProfileShareMsg
                    msgEvent={msg}
                    worker={worker!}
                    key={index}
                    content={msg.content}
                    eventId={msg.id}
                    keyPair={myKeyPair}
                    userPk={msg.pubkey}
                    createdAt={msg.created_at}
                    blogName={articleCache.blogName} //todo: fallback to query title
                    blogAvatar={
                      articleCache.blogPicture || userMap.get(blogPk)?.picture
                    }
                    articleTitle={articleCache.title} //todo: fallback to query title
                  />
                );
              } else {
                return (
                  <ProfileTextMsg
                    msgEvent={msg}
                    key={index}
                    pk={msg.pubkey}
                    content={msg.content}
                    eventId={msg.id}
                    keyPair={myKeyPair}
                    replyTo={msg.tags
                      .filter(t => t[0] === EventTags.P)
                      .map(t => {
                        return {
                          name: userMap.get(t[1])?.name,
                          pk: t[1],
                        };
                      })}
                    createdAt={msg.created_at}
                    worker={worker!}
                  />
                );
              }
            })}
          </ul>
        </div>
      </Left>
      <Right>
        <UserProfileBox
          pk={publicKey}
          about={userMap.get(publicKey)?.about}
          followCount={userContactList.size}
        />
        <hr />
        <RelayManager />
      </Right>
    </BaseLayout>
  );
};

export default connect(mapStateToProps)(ProfilePage);
