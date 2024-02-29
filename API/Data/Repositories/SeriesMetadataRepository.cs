using System.Linq;
using System.Threading.Tasks;
using API.Entities.Metadata;
using Microsoft.EntityFrameworkCore;

namespace API.Data.Repositories;

public interface ISeriesMetadataRepository
{
    void Update(SeriesMetadata seriesMetadata);
    Task<bool> FindByUrl(string url);
}

public class SeriesMetadataRepository : ISeriesMetadataRepository
{
    private readonly DataContext _context;

    public SeriesMetadataRepository(DataContext context)
    {
        _context = context;
    }

    public async Task<bool> FindByUrl(string url)
    {
        SeriesMetadata existing = await _context.SeriesMetadata.FirstOrDefaultAsync(sm => sm.WebLinks.Contains(url));
        return existing != null;
    }

    public void Update(SeriesMetadata seriesMetadata)
    {
        _context.SeriesMetadata.Update(seriesMetadata);
    }
}
