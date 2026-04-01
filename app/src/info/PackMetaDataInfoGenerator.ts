import ProjectInfoItem from "./ProjectInfoItem";
import { ProjectItemType } from "../app/IProjectItemData";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";
import ITagData from "../app/ITagData";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import Project from "../app/Project";
import Utilities from "../core/Utilities";

export interface IPackSummaryMetadata {
  pack?: IPackSummaryMetadataPack;
  offerStructure?: IPackSummaryMetadataOfferStructure;
  offer: IPackSummaryMetadataOffer;
}

export interface IPackSummaryMetadataOfferStructure {
  PackCount: number;
  Type: string;
  Version: string;
  DisplayName: string;
  Id: string;
}

export interface IPackSummaryMetadataPack {
  Offer: IPackSummaryMetadataPackOffer;
  Id: string;
  OfferId: string;
  Type: string;
}

export interface IPackSummaryMetadataPackOffer {
  Id: string;
}
export interface IPackSummaryMetadataOffer {
  result: IPackSummaryMetadataOfferResult;
}

export interface IPackSummaryMetadataOfferResult {
  offerModel: IPackSummaryMetadataOfferResultOfferModel;
}

export interface IPackSummaryMetadataOfferResultOfferModel {
  Id: string;
  contentApproved: string;
  catalogDescription: string;
  offerPrice: string;
  offerGenre: string;
  offerSubgenre: string;
  playerCount: string;
  purchasable: string;
  readableOfferId: string;
  releaseDate: string;
  retailProductId: string;
  submissionDate: string;
  worldType: string;
  cardTitle: string;
  originalReleaseDate: string;
  creatorName: string;
  isAnUpdate: boolean;
  lastUpdated: string;
  offerTitle: string;
  packType: string;
  offerType: string;
  submissionVersion: string;
}

/**
 * Aggregates pack metadata from various sources including marketplace submissions.
 */
export default class PackMetaDataInformationGenerator implements IProjectInfoGenerator {
  id = "PACKMETADATA";
  title = "General info";
  tags: string[] = [];
  tagMetadata: ITagData = {};
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    if (topicId >= 101 && topicId - 201 <= this.tags.length) {
      return {
        title: "Tags: " + this.tags[topicId - 201],
      };
    }
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.metadataId = infoSet.getFirstStringValue("PACKMETADATA", 101);
    info.metadataOfferId = infoSet.getFirstStringValue("PACKMETADATA", 102);
    info.cardTitle = infoSet.getFirstStringValue("PACKMETADATA", 141);
    info.catalogDescription = infoSet.getFirstStringValue("PACKMETADATA", 142);
    info.contentApproved = infoSet.getFirstStringValue("PACKMETADATA", 143);
    info.creatorName = infoSet.getFirstStringValue("PACKMETADATA", 144);
    info.isUpdate = infoSet.getFirstStringValue("PACKMETADATA", 146);
    info.lastUpdated = infoSet.getFirstStringValue("PACKMETADATA", 147);
    info.offerGenre = infoSet.getFirstStringValue("PACKMETADATA", 148);
    info.offerPrice = infoSet.getFirstStringValue("PACKMETADATA", 149);
    info.offerSubgenre = infoSet.getFirstStringValue("PACKMETADATA", 150);
    info.offerTitle = infoSet.getFirstStringValue("PACKMETADATA", 151);
    info.originalReleaseDate = infoSet.getFirstStringValue("PACKMETADATA", 152);
    info.packType = infoSet.getFirstStringValue("PACKMETADATA", 153);
    info.playerCount = infoSet.getFirstStringValue("PACKMETADATA", 154);
    info.purchasable = infoSet.getFirstStringValue("PACKMETADATA", 155);
    info.readableOfferId = infoSet.getFirstStringValue("PACKMETADATA", 156);
    info.releaseDate = infoSet.getFirstStringValue("PACKMETADATA", 157);
    info.retailProductId = infoSet.getFirstStringValue("PACKMETADATA", 158);
    info.submissionDate = infoSet.getFirstStringValue("PACKMETADATA", 159);
    info.submissionVersion = infoSet.getFirstStringValue("PACKMETADATA", 160);
    info.worldType = infoSet.getFirstStringValue("PACKMETADATA", 161);
    info.offerType = infoSet.getFirstStringValue("PACKMETADATA", 162);

    for (let i = 0; i < this.tags.length; i++) {
      info[this.tags[i]] = infoSet.getFirstStringValue("PACKMETADATA", 201 + i);
    }
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    let itemsCopy = project.getItemsByType(ProjectItemType.tagsMetadata);

    for (let i = 0; i < itemsCopy.length; i++) {
      const projectItem = itemsCopy[i];

      if (projectItem.itemType === ProjectItemType.tagsMetadata) {
        this.tagMetadata = (await projectItem.getJsonObject()) as ITagData;
      }
    }

    itemsCopy = project.getItemsByType(ProjectItemType.projectSummaryMetadata);

    for (let i = 0; i < itemsCopy.length; i++) {
      const projectItem = itemsCopy[i];

      let content = (await projectItem.getJsonObject()) as IPackSummaryMetadata;

      if (content && content.offer) {
        if (content.pack && content.pack.Id) {
          items.push(
            new ProjectInfoItem(InfoItemType.info, this.id, 101, "Metadata Pack Id", projectItem, content.pack.Id)
          );
        }

        if (content.pack && content.pack.OfferId) {
          items.push(
            new ProjectInfoItem(InfoItemType.info, this.id, 102, "Metadata Offer Id", projectItem, content.pack.OfferId)
          );

          if (this.tagMetadata) {
            for (const cat in this.tagMetadata) {
              const catVal = this.tagMetadata[cat];

              if (catVal) {
                for (const tag in catVal) {
                  const idList = catVal[tag];

                  for (const id of idList) {
                    if (Utilities.uuidEqual(id, content.pack.OfferId)) {
                      let index = -1;
                      for (let i = 0; i < this.tags.length; i++) {
                        if (this.tags[i] === cat) {
                          index = i;
                        }
                      }
                      if (index < 0) {
                        index = this.tags.length;
                        this.tags.push(cat);
                      }

                      items.push(
                        new ProjectInfoItem(InfoItemType.info, this.id, 201 + index, "Tag: " + cat, projectItem, tag)
                      );
                    }
                  }
                }
              }
            }
          }
        }

        if (content.offerStructure && content.offerStructure.Id) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.info,
              this.id,
              102,
              "Metadata Product Id",
              projectItem,
              content.offerStructure.Id
            )
          );
        }

        const om = content.offer?.result?.offerModel;

        if (om) {
          if (om.cardTitle) {
            items.push(new ProjectInfoItem(InfoItemType.info, this.id, 141, "Card Title", projectItem, om.cardTitle));
          }

          if (om.catalogDescription) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                142,
                "Catalog Description",
                projectItem,
                om.catalogDescription
              )
            );
          }

          if (om.contentApproved) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 143, "Content Approved", projectItem, om.contentApproved)
            );
          }
          if (om.creatorName) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 144, "Creator Name", projectItem, om.creatorName)
            );
          }

          if (om.isAnUpdate) {
            items.push(new ProjectInfoItem(InfoItemType.info, this.id, 146, "Is Update", projectItem, om.isAnUpdate));
          }

          if (om.lastUpdated) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 147, "Last Updated", projectItem, om.lastUpdated)
            );
          }

          if (om.offerGenre) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 148, "Product Genre", projectItem, om.offerGenre)
            );
          }

          if (om.offerPrice) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 149, "Product Price", projectItem, om.offerPrice)
            );
          }

          if (om.offerSubgenre) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 150, "Product Subgenre", projectItem, om.offerSubgenre)
            );
          }

          if (om.offerTitle) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 151, "Product Title", projectItem, om.offerTitle)
            );
          }

          if (om.originalReleaseDate) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                152,
                "Original Release Date",
                projectItem,
                om.originalReleaseDate
              )
            );
          }

          if (om.packType) {
            items.push(new ProjectInfoItem(InfoItemType.info, this.id, 153, "Pack Type", projectItem, om.packType));
          }

          if (om.playerCount) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 154, "Player Count", projectItem, "PC: " + om.playerCount)
            );
          }

          if (om.purchasable) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 155, "Purchasable", projectItem, om.purchasable)
            );
          }

          if (om.readableOfferId) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 156, "Readable Offer Id", projectItem, om.readableOfferId)
            );
          }

          if (om.releaseDate) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 157, "Release Date", projectItem, om.releaseDate)
            );
          }

          if (om.retailProductId) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 158, "Retail Product Id", projectItem, om.retailProductId)
            );
          }

          if (om.submissionDate) {
            items.push(
              new ProjectInfoItem(InfoItemType.info, this.id, 159, "Submission Date", projectItem, om.submissionDate)
            );
          }

          if (om.submissionVersion) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.info,
                this.id,
                160,
                "Submission Version",
                projectItem,
                om.submissionVersion
              )
            );
          }

          if (om.worldType) {
            items.push(new ProjectInfoItem(InfoItemType.info, this.id, 161, "World Type", projectItem, om.worldType));
          }

          if (om.offerType) {
            items.push(new ProjectInfoItem(InfoItemType.info, this.id, 162, "Offer Type", projectItem, om.offerType));
          }
        }
      }
    }
    return items;
  }
}
