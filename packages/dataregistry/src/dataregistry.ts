import { Token } from '@phosphor/coreutils';
import { IDisposable } from '@phosphor/disposable';
import { IConverterRegistry } from './converters';
import { Dataset, IDatasetRegistry } from './datasets';
import { resolveDataSet, resolveMimeType } from './resolvers';
import { createViewerMimeType, extractViewerLabel } from './viewers';

export interface IDataRegistryConfig {
  converters: IConverterRegistry;
  data: IDatasetRegistry;
}

/**
 * Registry that composes converter and dataset registry
 * in order to implement logic that requires both of them.
 */
export class DataRegistry {
  public readonly converters: IConverterRegistry;
  public readonly data: IDatasetRegistry;
  constructor(config: IDataRegistryConfig) {
    this.converters = config.converters;
    this.data = config.data;
  }

  registerURL(url: URL): IDisposable | null {
    const dataset = resolveDataSet(url);
    if (this.data.contains(dataset)) {
      return null;
    }
    return this.data.publish(dataset);
  }

  /**
   * Returns whether a URL, if registered, will have any conversions.
   *
   * Basically checks if the we will be able to resolve the mimetype just from the URL.
   */
  hasConversions(url: URL): boolean {
    return this.converters.listTargetMimeTypes(url, [resolveMimeType]).size > 1;
  }

  /**
   * Returns all mimetypes a URL that is already registered
   * can be converted to.
   */
  possibleMimeTypesForURL(url: URL): Set<string> {
    return this.converters.listTargetMimeTypes(
      url,
      this.data.mimeTypesForURL(url)
    );
  }
  /**
   * Returns the viewer labels for a given URL.
   */
  viewersForURL(url: URL): Set<string> {
    return new Set([...this.possibleMimeTypesForURL(url)]
      .map(extractViewerLabel)
      .filter(label => label !== null) as string[]);
  }

  /**
   * View a dataset with a certain URL with the viewer with a certain label.
   */
  async viewURL(url: URL, label: string): Promise<void> {
    const viewer: Dataset<() => Promise<void>> = await this.convertByURL(
      url,
      createViewerMimeType(label)
    );
    await viewer.data();
  }

  /**
   * Returns a dataset of the the target mime type converted from existing
   * data types with the same URL.
   *
   * Any datasets that are created will be added to the registery.
   */
  async convertByURL(url: URL, targetMimeType: string): Promise<Dataset<any>> {
    let finalDataSet: Dataset<any>;
    for await (const dataset of this.converters.convert(
      this.data.filterByURL(url),
      targetMimeType
    )) {
      finalDataSet = dataset;
      if (!this.data.contains(dataset)) {
        this.data.publish(dataset);
      }
    }
    return finalDataSet!;
  }
}

export interface IDataRegistry extends DataRegistry {}
export const IDataRegistry = new Token<IDataRegistry>(
  '@jupyterlab/dataregistry:IDataRegistry'
);
