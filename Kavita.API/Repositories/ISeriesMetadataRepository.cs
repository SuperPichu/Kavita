using Kavita.Models.Entities.Metadata;
using System.Threading.Tasks;
namespace Kavita.API.Repositories;

public interface ISeriesMetadataRepository
{
    void Update(SeriesMetadata seriesMetadata);
    public Task<bool> FindByUrl(string url);
}
