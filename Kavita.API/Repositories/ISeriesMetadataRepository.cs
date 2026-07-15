using Kavita.Models.Entities.Metadata;

namespace Kavita.API.Repositories;

public interface ISeriesMetadataRepository
{
    void Update(SeriesMetadata seriesMetadata);
    public Task<bool> FindByUrl(string url);
}
