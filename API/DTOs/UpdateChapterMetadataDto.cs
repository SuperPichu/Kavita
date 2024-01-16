using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using API.DTOs.CollectionTags;
using API.DTOs.Metadata;

namespace API.DTOs;

public class UpdateChapterMetadataDto
{
    public ChapterMetadataDto ChapterMetadata { get; set; } = default!;
}
