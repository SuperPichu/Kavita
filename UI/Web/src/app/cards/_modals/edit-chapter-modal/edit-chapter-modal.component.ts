import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component, DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit
} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  NgbActiveModal, NgbCollapse,
  NgbNav,
  NgbNavContent,
  NgbNavItem,
  NgbNavLink,
  NgbNavOutlet,
  NgbTooltip
} from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Breakpoint, UtilityService } from 'src/app/shared/_services/utility.service';
import { TypeaheadSettings } from 'src/app/typeahead/_models/typeahead-settings';
import { Chapter } from 'src/app/_models/chapter';
import { CollectionTag } from 'src/app/_models/collection-tag';
import { Genre } from 'src/app/_models/metadata/genre';
import { AgeRatingDto } from 'src/app/_models/metadata/age-rating-dto';
import { Language } from 'src/app/_models/metadata/language';
import { PublicationStatusDto } from 'src/app/_models/metadata/publication-status-dto';
import { Person, PersonRole } from 'src/app/_models/metadata/person';
import { Series } from 'src/app/_models/series';
import { SeriesMetadata } from 'src/app/_models/metadata/series-metadata';
import { Tag } from 'src/app/_models/tag';
import { CollectionTagService } from 'src/app/_services/collection-tag.service';
import { ImageService } from 'src/app/_services/image.service';
import { LibraryService } from 'src/app/_services/library.service';
import { MetadataService } from 'src/app/_services/metadata.service';
import { SeriesService } from 'src/app/_services/series.service';
import { UploadService } from 'src/app/_services/upload.service';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {CommonModule} from "@angular/common";
import {TypeaheadComponent} from "../../../typeahead/_components/typeahead.component";
import {CoverImageChooserComponent} from "../../cover-image-chooser/cover-image-chooser.component";
import {EditSeriesRelationComponent} from "../../edit-series-relation/edit-series-relation.component";
import {SentenceCasePipe} from "../../../_pipes/sentence-case.pipe";
import {MangaFormatPipe} from "../../../_pipes/manga-format.pipe";
import {DefaultDatePipe} from "../../../_pipes/default-date.pipe";
import {TimeAgoPipe} from "../../../_pipes/time-ago.pipe";
import {TagBadgeComponent} from "../../../shared/tag-badge/tag-badge.component";
import {PublicationStatusPipe} from "../../../_pipes/publication-status.pipe";
import {BytesPipe} from "../../../_pipes/bytes.pipe";
import {ImageComponent} from "../../../shared/image/image.component";
import {DefaultValuePipe} from "../../../_pipes/default-value.pipe";
import {translate, TranslocoModule} from "@ngneat/transloco";
import {TranslocoDatePipe} from "@ngneat/transloco-locale";
import {UtcToLocalTimePipe} from "../../../_pipes/utc-to-local-time.pipe";
import {EditListComponent} from "../../../shared/edit-list/edit-list.component";
import {AccountService} from "../../../_services/account.service";
import {LibraryType} from "../../../_models/library/library";
import {ToastrService} from "ngx-toastr";
import { ChapterMetadata } from 'src/app/_models/metadata/chapter-metadata';

enum TabID {
  General = 0,
  Metadata = 1,
  People = 2,
  WebLinks = 3,
  CoverImage = 4,
  Related = 5,
  Info = 6,
}

export interface EditChapterModalCloseResult {
  success: boolean;
  series: Series;
  coverImageUpdate: boolean;
  updateExternal: boolean
}

@Component({
  selector: 'app-edit-chapter-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgbNav,
    NgbNavContent,
    NgbNavItem,
    NgbNavLink,
    CommonModule,
    TypeaheadComponent,
    CoverImageChooserComponent,
    EditSeriesRelationComponent,
    SentenceCasePipe,
    MangaFormatPipe,
    DefaultDatePipe,
    TimeAgoPipe,
    TagBadgeComponent,
    PublicationStatusPipe,
    NgbTooltip,
    BytesPipe,
    ImageComponent,
    NgbCollapse,
    NgbNavOutlet,
    DefaultValuePipe,
    TranslocoModule,
    TranslocoDatePipe,
    UtcToLocalTimePipe,
    EditListComponent,
  ],
  templateUrl: './edit-chapter-modal.component.html',
  styleUrls: ['./edit-chapter-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditChapterModalComponent implements OnInit {

  public readonly modal = inject(NgbActiveModal);
  private readonly seriesService = inject(SeriesService);
  public readonly utilityService = inject(UtilityService);
  private readonly fb = inject(FormBuilder);
  public readonly imageService = inject(ImageService);
  private readonly libraryService = inject(LibraryService);
  private readonly collectionService = inject(CollectionTagService);
  private readonly uploadService = inject(UploadService);
  private readonly metadataService = inject(MetadataService);
  private readonly cdRef = inject(ChangeDetectorRef);
  public readonly accountService = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastr = inject(ToastrService);

  protected readonly TabID = TabID;
  protected readonly PersonRole = PersonRole;
  protected readonly Breakpoint = Breakpoint;

  @Input({required: true}) chapter!: Chapter;


  seriesVolumes: any[] = [];
  isLoadingVolumes = false;
  /**
   * A copy of the chapter from init. This is used to compare values for name fields to see if lock was modified
   */
  initChapter!: Chapter;

  volumeCollapsed: any = {};
  tabs = ['general-tab', 'metadata-tab', 'people-tab', 'web-links-tab', 'cover-image-tab', 'related-tab', 'info-tab'];
  active = this.tabs[0];
  editChapterForm!: FormGroup;
  libraryName: string | undefined = undefined;
  size: number = 0;
  hasForcedKPlus = false;
  forceIsLoading = false;


  // Typeaheads
  tagsSettings: TypeaheadSettings<Tag> = new TypeaheadSettings();
  languageSettings: TypeaheadSettings<Language> = new TypeaheadSettings();
  peopleSettings: {[PersonRole: string]: TypeaheadSettings<Person>} = {};
  collectionTagSettings: TypeaheadSettings<CollectionTag> = new TypeaheadSettings();
  genreSettings: TypeaheadSettings<Genre> = new TypeaheadSettings();

  tags: Tag[] = [];
  genres: Genre[] = [];
  ageRatings: Array<AgeRatingDto> = [];
  publicationStatuses: Array<PublicationStatusDto> = [];
  validLanguages: Array<Language> = [];
  webLinks: string | undefined = undefined;
  metadata!: ChapterMetadata;
  imageUrls: Array<string> = [];
  /**
   * Selected Cover for uploading
   */
  selectedCover: string = '';
  coverImageReset = false;

  saveNestedComponents: EventEmitter<void> = new EventEmitter();

  get WebLinks() {
    return this.webLinks?.split(',') || [''];
  }

  getPersonsSettings(role: PersonRole) {
    return this.peopleSettings[role];
  }

  ngOnInit(): void {
    this.imageUrls.push(this.imageService.getChapterCoverImage(this.chapter.id));


    this.initChapter = Object.assign({}, this.chapter);

    this.editChapterForm = this.fb.group({
      id: new FormControl(this.chapter.id, []),
      summary: new FormControl('', []),
      titleName: new FormControl(this.chapter.titleName),
      range: new FormControl(this.chapter.range, [Validators.required]),

      coverImageIndex: new FormControl(0, []),
      coverImageLocked: new FormControl(this.chapter.coverImageLocked, []),

      ageRating: new FormControl('', []),
      publicationStatus: new FormControl('', []),
      language: new FormControl('', []),
      releaseYear: new FormControl('', [Validators.minLength(4), Validators.maxLength(4), Validators.pattern(/([1-9]\d{3})|[0]{1}/)]),
    });
    this.cdRef.markForCheck();


    this.metadataService.getAllAgeRatings().subscribe(ratings => {
      this.ageRatings = ratings;
      this.cdRef.markForCheck();
    });

    this.metadataService.getAllPublicationStatus().subscribe(statuses => {
      this.publicationStatuses = statuses;
      this.cdRef.markForCheck();
    });

    this.metadataService.getAllValidLanguages().subscribe(validLanguages => {
      this.validLanguages = validLanguages;
      this.cdRef.markForCheck();
    });

    this.seriesService.getChapterMetadata(this.chapter.id).subscribe(metadata => {
      if (metadata) {
        this.metadata = metadata;

        this.setupTypeaheads();
        this.editChapterForm.get('summary')?.patchValue(this.metadata.summary);
        this.editChapterForm.get('ageRating')?.patchValue(this.metadata.ageRating);
        this.editChapterForm.get('publicationStatus')?.patchValue(this.metadata.publicationStatus);
        this.editChapterForm.get('language')?.patchValue(this.metadata.language);

        this.cdRef.markForCheck();

        this.editChapterForm.get('summary')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(val => {
          this.metadata.summary = val;
          this.cdRef.markForCheck();
        });


        this.editChapterForm.get('ageRating')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(val => {
          this.metadata.ageRating = parseInt(val + '', 10);
          this.cdRef.markForCheck();
        });

        this.editChapterForm.get('publicationStatus')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(val => {
          this.metadata.publicationStatus = parseInt(val + '', 10);
          this.cdRef.markForCheck();
        });
      }
    });

    this.isLoadingVolumes = true;
    this.cdRef.markForCheck();
  }


  setupTypeaheads() {
    forkJoin([
      this.setupCollectionTagsSettings(),
      this.setupTagSettings(),
      this.setupGenreTypeahead(),
      this.setupPersonTypeahead(),
      this.setupLanguageTypeahead()
    ]).subscribe(results => {
      this.cdRef.markForCheck();
    });
  }

  setupCollectionTagsSettings() {
    this.collectionTagSettings.minCharacters = 0;
    this.collectionTagSettings.multiple = true;
    this.collectionTagSettings.id = 'collections';
    this.collectionTagSettings.unique = true;
    this.collectionTagSettings.addIfNonExisting = true;
    this.collectionTagSettings.fetchFn = (filter: string) => this.fetchCollectionTags(filter).pipe(map(items => this.collectionTagSettings.compareFn(items, filter)));
    this.collectionTagSettings.addTransformFn = ((title: string) => {
      return {id: 0, title: title, promoted: false, coverImage: '', summary: '', coverImageLocked: false };
    });
    this.collectionTagSettings.compareFn = (options: CollectionTag[], filter: string) => {
      return options.filter(m => this.utilityService.filter(m.title, filter));
    }
    this.collectionTagSettings.compareFnForAdd = (options: CollectionTag[], filter: string) => {
      return options.filter(m => this.utilityService.filterMatches(m.title, filter));
    }
    this.collectionTagSettings.selectionCompareFn = (a: CollectionTag, b: CollectionTag) => {
      return a.title === b.title;
    }

    return of(true);
  }

  setupTagSettings() {
    this.tagsSettings.minCharacters = 0;
    this.tagsSettings.multiple = true;
    this.tagsSettings.id = 'tags';
    this.tagsSettings.unique = true;
    this.tagsSettings.addIfNonExisting = true;


    this.tagsSettings.compareFn = (options: Tag[], filter: string) => {
      return options.filter(m => this.utilityService.filter(m.title, filter));
    }
    this.tagsSettings.fetchFn = (filter: string) => this.metadataService.getAllTags()
      .pipe(map(items => this.tagsSettings.compareFn(items, filter)));

    this.tagsSettings.addTransformFn = ((title: string) => {
      return {id: 0, title: title };
    });
    this.tagsSettings.selectionCompareFn = (a: Tag, b: Tag) => {
      return a.title.toLowerCase() == b.title.toLowerCase();
    }
    this.tagsSettings.compareFnForAdd = (options: Tag[], filter: string) => {
      return options.filter(m => this.utilityService.filterMatches(m.title, filter));
    }

    if (this.metadata.tags) {
      this.tagsSettings.savedData = this.metadata.tags;
    }
    return of(true);
  }

  setupGenreTypeahead() {
    this.genreSettings.minCharacters = 0;
    this.genreSettings.multiple = true;
    this.genreSettings.id = 'genres';
    this.genreSettings.unique = true;
    this.genreSettings.addIfNonExisting = true;
    this.genreSettings.fetchFn = (filter: string) => {
      return this.metadataService.getAllGenres()
      .pipe(map(items => this.genreSettings.compareFn(items, filter)));
    };
    this.genreSettings.compareFn = (options: Genre[], filter: string) => {
      return options.filter(m => this.utilityService.filter(m.title, filter));
    }
    this.genreSettings.compareFnForAdd = (options: Genre[], filter: string) => {
      return options.filter(m => this.utilityService.filterMatches(m.title, filter));
    }
    this.genreSettings.selectionCompareFn = (a: Genre, b: Genre) => {
      return a.title.toLowerCase() == b.title.toLowerCase();
    }

    this.genreSettings.addTransformFn = ((title: string) => {
      return {id: 0, title: title };
    });

    if (this.metadata.genres) {
      this.genreSettings.savedData = this.metadata.genres;
    }
    return of(true);
  }

  updateFromPreset(id: string, presetField: Array<Person> | undefined, role: PersonRole) {
    const personSettings = this.createBlankPersonSettings(id, role)
    if (presetField && presetField.length > 0) {
      const fetch = personSettings.fetchFn as ((filter: string) => Observable<Person[]>);
      return fetch('').pipe(map(people => {
        const presetIds = presetField.map(p => p.id);
        personSettings.savedData = people.filter(person => presetIds.includes(person.id));
        this.peopleSettings[role] = personSettings;
        this.updatePerson(personSettings.savedData as Person[], role);
        return true;
      }));
    } else {
      this.peopleSettings[role] = personSettings;
      return of(true);
    }
  }

  setupLanguageTypeahead() {
    this.languageSettings.minCharacters = 0;
    this.languageSettings.multiple = false;
    this.languageSettings.id = 'language';
    this.languageSettings.unique = true;
    this.languageSettings.addIfNonExisting = false;
    this.languageSettings.compareFn = (options: Language[], filter: string) => {
      return options.filter(m => this.utilityService.filter(m.title, filter));
    }
    this.languageSettings.compareFnForAdd = (options: Language[], filter: string) => {
      return options.filter(m => this.utilityService.filterMatches(m.title, filter));
    }
    this.languageSettings.fetchFn = (filter: string) => of(this.validLanguages)
      .pipe(map(items => this.languageSettings.compareFn(items, filter)));

    this.languageSettings.selectionCompareFn = (a: Language, b: Language) => {
      return a.isoCode == b.isoCode;
    }

    const l = this.validLanguages.find(l => l.isoCode === this.metadata.language);
    if (l !== undefined) {
      this.languageSettings.savedData = l;
    }
    return of(true);
  }

  setupPersonTypeahead() {
    this.peopleSettings = {};

    return forkJoin([
      this.updateFromPreset('writer', this.metadata.writers, PersonRole.Writer),
      this.updateFromPreset('character', this.metadata.characters, PersonRole.Character),
      this.updateFromPreset('colorist', this.metadata.colorists, PersonRole.Colorist),
      this.updateFromPreset('cover-artist', this.metadata.coverArtists, PersonRole.CoverArtist),
      this.updateFromPreset('editor', this.metadata.editors, PersonRole.Editor),
      this.updateFromPreset('inker', this.metadata.inkers, PersonRole.Inker),
      this.updateFromPreset('letterer', this.metadata.letterers, PersonRole.Letterer),
      this.updateFromPreset('penciller', this.metadata.pencillers, PersonRole.Penciller),
      this.updateFromPreset('publisher', this.metadata.publishers, PersonRole.Publisher),
      this.updateFromPreset('translator', this.metadata.translators, PersonRole.Translator)
    ]).pipe(map(results => {
      return of(true);
    }));
  }

  fetchPeople(role: PersonRole, filter: string) {
    return this.metadataService.getAllPeople().pipe(map(people => {
      return people.filter(p => p.role == role && this.utilityService.filter(p.name, filter));
    }));
  }

  createBlankPersonSettings(id: string, role: PersonRole) {
    var personSettings = new TypeaheadSettings<Person>();
    personSettings.minCharacters = 0;
    personSettings.multiple = true;
    personSettings.unique = true;
    personSettings.addIfNonExisting = true;
    personSettings.id = id;
    personSettings.compareFn = (options: Person[], filter: string) => {
      return options.filter(m => this.utilityService.filter(m.name, filter));
    }
    personSettings.compareFnForAdd = (options: Person[], filter: string) => {
      return options.filter(m => this.utilityService.filterMatches(m.name, filter));
    }

    personSettings.selectionCompareFn = (a: Person, b: Person) => {
      return a.name == b.name && a.role == b.role;
    }
    personSettings.fetchFn = (filter: string) => {
      return this.fetchPeople(role, filter).pipe(map(items => personSettings.compareFn(items, filter)));
    };

    personSettings.addTransformFn = ((title: string) => {
      return {id: 0, name: title, role: role };
    });

    return personSettings;
  }

  close() {
    this.modal.close({success: false, series: undefined, coverImageUpdate: this.coverImageReset, updateExternal: this.hasForcedKPlus});
  }

  forceScan() {
    this.forceIsLoading = true;
    this.metadataService.forceRefreshFromPlus(this.chapter.id).subscribe(() => {
      this.hasForcedKPlus = true;
      this.forceIsLoading = false;
      this.toastr.info(translate('toasts.force-kavita+-refresh-success'));
      this.cdRef.markForCheck();
    });
  }

  fetchCollectionTags(filter: string = '') {
    return this.collectionService.search(filter);
  }

  updateWeblinks(items: Array<string>) {
    this.webLinks = items.map(s => s.replaceAll(',', '%2C')).join(',');
  }


  save() {
    const model = this.editChapterForm.value;
    const selectedIndex = this.editChapterForm.get('coverImageIndex')?.value || 0;

    const apis = [
      this.seriesService.updateChapterMetadata({...this.metadata,...model})
    ];


    if (selectedIndex > 0 && this.selectedCover !== '') {
      apis.push(this.uploadService.updateSeriesCoverImage(model.id, this.selectedCover));
    }

    this.saveNestedComponents.emit();

    forkJoin(apis).subscribe(results => {
      this.modal.close({success: true, series: model, coverImageUpdate: selectedIndex > 0 || this.coverImageReset, updateExternal: this.hasForcedKPlus});
    });
  }


  updateTags(tags: Tag[]) {
    this.tags = tags;
    this.metadata.tags = tags;
    this.cdRef.markForCheck();
  }

  updateGenres(genres: Genre[]) {
    this.genres = genres;
    this.metadata.genres = genres;
    this.cdRef.markForCheck();
  }

  updateLanguage(language: Array<Language>) {
    if (language.length === 0) {
      this.metadata.language = '';
      return;
    }
    this.metadata.language = language[0].isoCode;
    this.cdRef.markForCheck();
  }

  updatePerson(persons: Person[], role: PersonRole) {
    switch (role) {
      case PersonRole.CoverArtist:
        this.metadata.coverArtists = persons;
        break;
      case PersonRole.Character:
        this.metadata.characters = persons;
        break;
      case PersonRole.Colorist:
        this.metadata.colorists = persons;
        break;
      case PersonRole.Editor:
        this.metadata.editors = persons;
        break;
      case PersonRole.Inker:
        this.metadata.inkers = persons;
        break;
      case PersonRole.Letterer:
        this.metadata.letterers = persons;
        break;
      case PersonRole.Penciller:
        this.metadata.pencillers = persons;
        break;
      case PersonRole.Publisher:
        this.metadata.publishers = persons;
        break;
      case PersonRole.Writer:
        this.metadata.writers = persons;
        break;
      case PersonRole.Translator:
        this.metadata.translators = persons;
    }
    this.cdRef.markForCheck();
  }

  updateSelectedIndex(index: number) {
    this.editChapterForm.patchValue({
      coverImageIndex: index
    });
    this.cdRef.markForCheck();
  }

  updateSelectedImage(url: string) {
    this.selectedCover = url;
    this.cdRef.markForCheck();
  }

  handleReset() {
    this.coverImageReset = true;
    this.editChapterForm.patchValue({
      coverImageLocked: false
    });
    this.cdRef.markForCheck();
  }

  unlock(b: any, field: string) {
    if (b) {
      b[field] = !b[field];
    }
    this.cdRef.markForCheck();
  }

}
