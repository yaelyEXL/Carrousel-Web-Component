import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from './pnx-card-style';
import { until } from 'lit-html/directives/until.js';



@customElement('pnx-card')
export class PnxCard extends LitElement {


    static override styles = styles;
    @property()
    doc: any;
    @property()
    vid: any;
    @property()
    language: any;
    @property()
    scope: any;
    @property()
    tab: any;

    override render() {
        const img = this.getThumbnailLinks();
        const imgPromise = img.then(url => {
            console.log(`getImageUrl returned ${url}`)
            return html`<img src=${url}>`
        })

        return html`
            
            <a  href="${this.getDeeplink()}" target="_blank" aria-label="">
                ${until(imgPromise, `no image yet`)}

                <div class="record-details">
                    <h2>${this?.doc?.pnx?.display?.title?.[0] ?? ''}</h2>
                    <span>${this?.doc?.pnx?.display?.publisher?.[0] ?? ''}</span>
                </div>
            </a>
            
        `
    }
    private getDeeplink() {
        let deeplink = "";
        const parsedUrl = new URL(this.doc["@id"]);
        const protocol = this.getProtocol(parsedUrl);
        const host = this.getHost(parsedUrl);
        const primoMapping = this.isPrimo() ? "/primo-explore" : "/discovery";
        const state = this.getState();
        const recordId = this.doc.pnx.control.recordid;
        const context = this.doc.context;


        deeplink = protocol + host + primoMapping + state + "&docid=" + recordId + "&context=" + context + "&vid=" + this.vid + "&lang=" + this.language + "&search_scope=" + this.scope + "&tab=" + this.tab;

        return deeplink;
    }
    private getProtocol(url: URL) {
        return url.protocol + "//";
    }

    private getHost(url: URL) {
        return url.host;
    }

    private isPrimo() {
        return false;
        //TODO
    }
    private getState() {
        return "/fulldisplay?"
    }

    private async getThumbnailLinks() {

        try {
            let linksArray = this.doc.delivery.link || [];
            let type = this.getType(false, this.doc);

            const defaultThumbnail = this.defineDefaultThumbnail(type);
            let thumbnailLinks = linksArray.filter((e: any) => e.displayLabel === 'thumbnail')


            if (!this.isCDI()) {
                // const almaD = await this.getThumbnailFromAlmaD(item, isVirtualBrowse, virtualBrowseItem);
                // if (almaD) {
                //   return almaD;
                // }

                let other = await this.getThumbnailFromOther(thumbnailLinks);
                if (other) {
                  return other;
                }

                const syndeticsEXL = await this.getThumbnailFromSyndeticsEXL(thumbnailLinks);
                if (syndeticsEXL) {
                    return syndeticsEXL;
                }

                const syndetics = await this.getThumbnailFromSyndetics(thumbnailLinks);
                if (syndetics) {
                    return syndetics;
                }

                const google = await this.getThumbnailFromGoogle(thumbnailLinks);
                if (google) {
                    return google;
                }
            }
            return defaultThumbnail.linkURL;

        } catch (error) {
            console.error('Error in getThumbnailLinks:', error);
            throw error; // Rethrow the error for higher-level error handling
        }
    }

    // private async getThumbnailFromAlmaD() {
    //     try {
    //         if (this.isAlmaD()) {
    //             const thumbnailLink = await this.getAlmaDigitalThumbnailForPnx();
    //             return await this.resolveAlmaDigitalImage(thumbnailLink);
    //         } else {
    //             return '';
    //         }
    //     } catch (error) {
    //         console.error('Error in getThumbnailFromAlmaD:', error);
    //         return '';
    //     }
    // }

    private async getThumbnailFromOther(thumbnailLinks: any) {

        let otherThumbnailLinks = thumbnailLinks.filter(this.getAllButSpecificLink, 'amazon');
        otherThumbnailLinks = otherThumbnailLinks.filter(this.getAllButSpecificLink, 'syndetics.com');
        otherThumbnailLinks = otherThumbnailLinks.filter(this.getAllButSpecificLink, 'google.com');

        if (otherThumbnailLinks.length) {
            const promiseArray = otherThumbnailLinks.map((link: any) => {
                this.removeLabelFromLinkUrl(link);
                return this.getImageLink(link.linkURL);
            });

            try {
                const result = await Promise.race(promiseArray);
                return result || '';
            } catch (error) {
                console.error('Error fetching images:', error);
                return '';
            }
        } else {
            return '';
        }
    }
    private getAllButSpecificLink(thumbnailLink : any, linkIdentifier:string) {
        // const linkIdentifier = this;
        if (typeof thumbnailLink === 'string') {//todo change
            return thumbnailLink.indexOf(linkIdentifier) === -1
        }
        let linkURL = thumbnailLink?.linkURL;
        if(!linkURL) {
            return false;
        }
        if (typeof linkURL === 'string') {//todo change
            return linkURL.indexOf(linkIdentifier) === -1;
        }
        return linkURL.linkURL.indexOf(linkIdentifier) === -1;
    }

    private async getThumbnailFromSyndeticsEXL(thumbnailLinks: any) {
        const syndeticsLinks = thumbnailLinks.filter((link: any) => this.getSpecificLink(link, 'syndetics.com') || this.getSpecificLink(link, 'primo'));

        if (syndeticsLinks.length > 0 || !this.isPrimo()) {
            const isbns = [...new Set((this.doc?.pnx?.addata?.isbn || []).concat(this.doc?.pnx?.addata?.eisbn || []))];
            const issns = [...new Set((this.doc?.pnx?.addata?.issn || []).concat(this.doc?.pnx?.addata?.eissn || []))];
            const upc = this.doc?.pnx?.addata?.upcid || [];

            const syntetixBaseUrl = "https://syndetics.com/index.php?client=primo&";

            for (const isbn of isbns) {
                syndeticsLinks.push(this.createLinkObj(`${syntetixBaseUrl}isbn=${isbn}/sc.jpg`));
            }

            for (const issn of issns) {
                syndeticsLinks.push(this.createLinkObj(`${syntetixBaseUrl}issn=${issn}/sc.jpg`));
            }

            for (const code of upc) {
                syndeticsLinks.push(this.createLinkObj(`${syntetixBaseUrl}upc=${code}/sc.jpg`));
            }

            if (syndeticsLinks.length > 0) {
                return this.handleSyndeticsThumbnailLinks(syndeticsLinks);
            }
        }

        return '';
    }

    private async getThumbnailFromSyndetics(thumbnailLinks: any) {
        const syndeticsLinks = thumbnailLinks.filter((link: any) => this.getSpecificLink(link, 'syndetics.com'));

        if (syndeticsLinks.length > 0) {
            return this.handleSyndeticsThumbnailLinks(syndeticsLinks);
        }
        return '';
    }

    public getSpecificLink(thumbnailLink: any, linkIdentifier: any) {

        if (typeof thumbnailLink === 'string') {//todo change
            return thumbnailLink.indexOf(linkIdentifier) > -1;
        }
        let linkURL = thumbnailLink ? thumbnailLink.linkURL : undefined;
        if (!linkURL) {
            return false;
        }
        if (typeof linkURL === 'string') {//todo change
            return linkURL.indexOf(linkIdentifier) > -1;
        }
        return linkURL.linkURL.indexOf(linkIdentifier) > -1;
    }

    private async handleSyndeticsThumbnailLinks(syndeticsLinks: any) {
        let syndeticsProxy = this.getSyndetixWithProxy();
        let promiseArray = syndeticsLinks.map((link: any) => {
            const imageUrl = link.linkURL.replace('https://syndetics.com/index.php?client=', syndeticsProxy);
            return this.getImageLink(imageUrl);
        })
        // const found = Promise.any(promiseArray);
        // try {
        //     const ret = await found;
        //     return retg;
        // } catch (e) {
        //     return ''
        // }
        const ret = await this.createPromiseOnlyFailOnAllFailedResolveFirstSuccess(promiseArray);
        return ret;
    }

    private async getThumbnailFromGoogle(thumbnailLinks: any) {

        if (this.showICPLicenseFooter()) {
            return '';
        }

        const googleLink = thumbnailLinks.find((link: any) => this.getSpecificLink(link, 'books.google.com'));

        if (!googleLink) {
            return ''; // early return if no Google link is found
        }

        try {
            const linkUrl = googleLink.linkURL;
            const gbUrl = linkUrl.replace('&callback=updateGBSCover', '');
            const response = await fetch(gbUrl);
            const data = await response.text();
            let jsonData = JSON.parse(data.substring(data.indexOf('{'),data.indexOf('}')+2));
            const keys = Object.keys(jsonData);

            if (keys.length > 0) {
                let thumbnailUrl = jsonData[keys[0]].thumbnail_url;

                if (thumbnailUrl) {
                    const returnedLink = {
                        displayLabel: 'thumbnail',
                        linkType: 'http://purl.org/pnx/linkType/thumbnail',
                        linkURL: this.handleLink(thumbnailUrl),
                    };
                    return returnedLink.linkURL;
                }
            }


        } catch (error) {
            return '';
        }

        return '';
    }

    public async createPromiseOnlyFailOnAllFailedResolveFirstSuccess(promiseArray: any) {
        const reflectedPromises = promiseArray.map(this.reflect);
        const results = await Promise.all(reflectedPromises);

        const successfulResult = results.find(result => result.status === 'resolved');
        if (successfulResult) {
            return (successfulResult.value);
        } else {
            return ('');
        }
    }
    private reflect(promise: any) {
        return promise.then(
            (v: any) => ({ value: v, status: "resolved" }),
            (e: any) => ({ error: e, status: "rejected" })
        );
    }
    private showICPLicenseFooter() {
        return false;
    }
    private removeLabelFromLinkUrl(thumbnailLink: any) {
        let linkUrl = thumbnailLink.linkURL;
        if (linkUrl && linkUrl.includes('$$L')) {
            thumbnailLink.linkURL = linkUrl.substr(0, linkUrl.indexOf('$$L')).trim();
        }
    }
    private getType(featuredResult: any, doc: any) {
        if (featuredResult) {
            return 'book'
        }
        else {
            return doc && doc.pnx.display.type ? doc.pnx.display.type[0] : []
        }
    }

    private defineDefaultThumbnail(type: any) {
        return {
            displayLabel: 'thumbnail',
            linkType: 'http://purl.org/pnx/linkType/thumbnail',
            linkURL: type.length > 0 ? 'img/icon_' + type + '.png' : undefined
        };
    }

    private isCDI() {
        const recordId = this.doc?.pnx?.control?.recordid[0];
        const context = this.doc?.context;
        const adaptor = this.doc?.adaptor;
        return context === 'PC' || (recordId && recordId.startsWith('TN_')) || adaptor === 'Primo Central';
    }

    private isAlmaD() {
        if (this.isPrimo()) {
            return false;
        }
        if (this.doc.context === 'SP' && this.doc?.pnx?.control?.sourceid === 'alma' && this.doc.delivery?.electronicServices) {
            return (this.doc.delivery.electronicServices.filter(
                (svc: any) => svc.serviceType === 'DIGITAL').length > 0);
        } else {
            return this.doc.delivery['hasD'] === true || this.doc.delivery['digitalAuxiliaryMode'] === true;
        }
    }

    // private async getAlmaDigitalThumbnailForPnx(): Promise<string> {
    //     const mmsId = this.doc?.pnx?.control?.sourcerecordid?.[0];
    //     const institutionCode = this.doc?.delivery?.recordInstitutionCode;
    //     let thumbnailUrl = this.getAlmaDigitalThumbnailUrl(mmsId);

    //     // For shared D - find the correct link to the thumbnail
    //     if (this.doc?.delivery?.sharedDigitalCandidates && this.doc.delivery.sharedDigitalCandidates.length > 0) {
    //         const response = await this.$http.post(`${this.restBaseURLs.getThumbnail}/${institutionCode}/${mmsId}?vid=${this.vid()}`, _get(this.doc, 'delivery.sharedDigitalCandidates'));
    //         thumbnailUrl = response.data as string;
    //     } else if (this.doc?.pnx?.control?.isDedup) {
    //         const response = await this.$http.get(`${this.restBaseURLs.getThumbnail}/${mmsId}?vid=${this.vid()}`);
    //         if (!response?.data?.hasDigitalInventory) {
    //             return '';
    //         }
    //     }

    //     if (this.isEsploroRecord()) {
    //         thumbnailUrl += '?calculateAccessRights=true';
    //     }

    //     return thumbnailUrl;
    // }

    private isEsploroRecord() {
        return this.doc.pnx.control.sourceformat?.[0] === 'ESPLORO' || false;
    }
    private getAlmaDigitalThumbnailUrl(mmsId: any) {
        return "/view/delivery/thumbnail/" + this.vid + "/" + mmsId;
    }

    private resolveAlmaDigitalImage(thumbnailUrl: any) {
        return this.getImageLink(thumbnailUrl);
    }

    private createLinkObj(url: any) {
        return {
            displayLabel: 'thumbnail',
            linkType: 'http://purl.org/pnx/linkType/thumbnail',
            linkURL: url
        };
    }

    public async getImageLink(imageUrl: string) {
        return new Promise((resolve, reject) => {
            if (!imageUrl) {
                reject('');
                return;
            }

            const image = new Image();
            image.onload = () => {
                if (image.width > 1) {
                    resolve(imageUrl);
                } else {
                    reject('');
                }
            };

            image.onerror = () => {
                reject('');
            };

            image.src = this.handleLink(imageUrl);
        });
    }

    private handleLink(link: string) {
        let newLink = link;
        if (window.location.protocol === 'https:') {
            newLink = link.replace('http://', 'https');
        }
        return newLink;
    }

    private getSyndetixWithProxy() {
        return "https://proxy-na.hosted.exlibrisgroup.com/exl_rewrite/syndetics.com/index.php?client="
    }
}



